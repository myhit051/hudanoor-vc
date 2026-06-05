import { google } from 'googleapis';
import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate, requireAdmin } from '../lib/auth-middleware.js';
import { parseSheetDate } from '../lib/sheet-date.js';

// Read all rows from a Google Sheet range (used for legacy import).
// Use UNFORMATTED_VALUE so date cells come back as Excel serial numbers
// (we'd otherwise get locale-formatted strings like '30/4/2026' that JS
// parses as month=30 and lands on the wrong month).
async function readLegacyIncomeSheet() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'รายรับ!A:K',
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  });
  return response.data.values || [];
}

function normalizeChannel(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'online' || s.includes('ออนไลน์')) return 'online';
  return 'store';
}

// Loose match for branch/platform names — Sheet data can drift from the
// system's configured names (case, whitespace, hidden chars). Use this
// for commission matching so "Tiktok" / "tiktok" / " Tiktok " all line up.
function normName(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function safeParseJSON(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToRun(row) {
  return {
    id: row.id,
    period: row.period,
    status: row.status,
    totalSalary: Number(row.total_salary) || 0,
    totalCommission: Number(row.total_commission) || 0,
    totalAmount: Number(row.total_amount) || 0,
    employeeCount: Number(row.employee_count) || 0,
    note: row.note || '',
    createdBy: row.created_by || '',
    finalizedAt: row.finalized_at || '',
    finalizedBy: row.finalized_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToItem(row) {
  return {
    id: row.id,
    payrollRunId: row.payroll_run_id,
    employeeId: row.employee_id,
    employeeName: row.employee_name,
    position: row.position || '',
    homeBranch: row.home_branch || '',
    salary: Number(row.salary) || 0,
    totalCommission: Number(row.total_commission) || 0,
    totalAmount: Number(row.total_amount) || 0,
    commissionBreakdown: safeParseJSON(row.commission_breakdown, []),
    adjustment: Number(row.adjustment) || 0,
    adjustmentNote: row.adjustment_note || '',
    status: row.status,
    paidAt: row.paid_at || '',
    paidBy: row.paid_by || '',
    paidMethod: row.paid_method || '',
    note: row.note || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Build a normalized Set of salesperson (recorded_by) names for a commission
// row. Returns null when no specific salesperson is set → match ALL recorders.
function salespersonMatcher(commission) {
  const names = Array.isArray(commission.salespersonNames) ? commission.salespersonNames : [];
  const normalized = names.map(normName).filter((n) => n !== '');
  if (normalized.length === 0) return null;
  return new Set(normalized);
}

// Calculate commission breakdown for an employee given the income rows.
// If commission.branchOrPlatform is empty → match ALL sales in that channel
// (i.e. employee earns commission across every branch/platform of that channel).
// If commission.salespersonNames is set → only count sales recorded by those users.
function calcEmployeeCommission(employee, incomes) {
  const breakdown = (employee.branchCommissions || []).map((commission) => {
    const wantsAllInChannel = !commission.branchOrPlatform || commission.branchOrPlatform.trim() === '';
    const targetChannel = normName(commission.channel);
    const targetBranch = normName(commission.branchOrPlatform);
    const salespeople = salespersonMatcher(commission);
    const salesForBranch = incomes
      .filter((income) => {
        if (normName(income.channel) !== targetChannel) return false;
        if (salespeople && !salespeople.has(normName(income.recordedBy))) return false;
        if (wantsAllInChannel) return true;
        return normName(income.branchOrPlatform) === targetBranch;
      })
      .reduce((sum, income) => sum + income.totalAmount, 0);
    const rate = Number(commission.commissionRate) || 0;
    const commissionAmount = salesForBranch * (rate / 100);
    return {
      channel: commission.channel,
      branchOrPlatform: commission.branchOrPlatform || '(ทุกสาขา)',
      sales: salesForBranch,
      rate,
      commission: commissionAmount,
    };
  });
  const totalCommission = breakdown.reduce((s, b) => s + b.commission, 0);
  return { breakdown, totalCommission };
}

// Load sales for a YYYY-MM period from BOTH sales_orders (real sales)
// AND legacy_sales (imported from Sheet — payroll-only).
async function loadIncomesForPeriod(period) {
  if (!period) return [];
  const db = getTursoClient();
  const result = await db.execute({
    sql: `
      SELECT id, date, channel, branch_or_platform, total_amount, recorded_by, 'sales' AS source FROM sales_orders WHERE date LIKE ?
      UNION ALL
      SELECT id, date, channel, branch_or_platform, total_amount, recorded_by, 'legacy' AS source FROM legacy_sales WHERE date LIKE ?
    `,
    args: [`${period}-%`, `${period}-%`],
  });
  return result.rows.map((row) => ({
    id: row.id,
    date: row.date,
    channel: row.channel || 'store',
    branchOrPlatform: row.branch_or_platform || '',
    totalAmount: Number(row.total_amount) || 0,
    recordedBy: row.recorded_by || '',
    source: row.source,
  }));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    // ─── GET ───────────────────────────────────────────
    if (req.method === 'GET') {
      const { period, runId, action } = req.query;

      // Preview legacy sales import — show counts based on row position
      // (we ignore the ID column because it has duplicates / blanks)
      if (action === 'import-sales-preview') {
        const rows = await readLegacyIncomeSheet();
        const dataRows = rows.slice(1);
        let validRows = 0;
        let skippedEmpty = 0;
        for (const row of dataRows) {
          const total = parseFloat(row[7]) || 0;
          const date = parseSheetDate(row[1]);
          if (!date || total <= 0) skippedEmpty++;
          else validRows++;
        }
        // Count both: sheet-imported rows in legacy_sales + leftover rows in sales_orders from old import strategy
        const prevLegacy = await db.execute(
          `SELECT COUNT(*) AS c FROM legacy_sales WHERE import_source = 'sheet-import'`
        );
        const prevOrders = await db.execute(
          `SELECT COUNT(*) AS c FROM sales_orders WHERE recorded_by = 'sheet-import'`
        );
        const previousImports = (Number(prevLegacy.rows[0]?.c) || 0) + (Number(prevOrders.rows[0]?.c) || 0);
        return res.status(200).json({
          totalInSheet: dataRows.length,
          validRows,
          skippedEmpty,
          previousImports,
          willImport: validRows,
        });
      }

      // Commission report (replaces former /api/commission-reports endpoint)
      if (action === 'report') {
        const empResult = await db.execute(
          `SELECT id, name, position, salary, branch_commissions, home_branch
           FROM employees WHERE is_active = 1 ORDER BY name`
        );
        const employees = empResult.rows.map((row) => ({
          id: row.id,
          name: row.name || '',
          position: row.position || '',
          salary: Number(row.salary) || 0,
          homeBranch: row.home_branch || '',
          branchCommissions: safeParseJSON(row.branch_commissions, []),
        }));

        const incomes = period ? await loadIncomesForPeriod(period) : [];
        const commissionReports = employees.map((employee) => {
          let storeSales = 0;
          let onlineSales = 0;
          let storeCommission = 0;
          let onlineCommission = 0;

          employee.branchCommissions.forEach((commission) => {
            const wantsAllInChannel = !commission.branchOrPlatform || commission.branchOrPlatform.trim() === '';
            const targetChannel = normName(commission.channel);
            const targetBranch = normName(commission.branchOrPlatform);
            const salespeople = salespersonMatcher(commission);
            const salesForBranch = incomes
              .filter((income) => {
                if (normName(income.channel) !== targetChannel) return false;
                if (salespeople && !salespeople.has(normName(income.recordedBy))) return false;
                if (wantsAllInChannel) return true;
                return normName(income.branchOrPlatform) === targetBranch;
              })
              .reduce((sum, income) => sum + income.totalAmount, 0);
            const commissionAmount = salesForBranch * ((Number(commission.commissionRate) || 0) / 100);
            if (commission.channel === 'store') {
              storeSales += salesForBranch;
              storeCommission += commissionAmount;
            } else if (commission.channel === 'online') {
              onlineSales += salesForBranch;
              onlineCommission += commissionAmount;
            }
          });

          const totalCommission = storeCommission + onlineCommission;
          return {
            employeeId: employee.id,
            employeeName: employee.name,
            position: employee.position,
            homeBranch: employee.homeBranch,
            period: period || new Date().toISOString().substring(0, 7),
            storeSales,
            onlineSales,
            storeCommission,
            onlineCommission,
            totalCommission,
            salary: employee.salary,
            totalEarnings: employee.salary + totalCommission,
            branchCommissions: employee.branchCommissions,
          };
        });

        return res.status(200).json({
          success: true,
          data: commissionReports,
          period: period || new Date().toISOString().substring(0, 7),
          totalEmployees: commissionReports.length,
          totalCommissions: commissionReports.reduce((s, r) => s + r.totalCommission, 0),
        });
      }

      // Preview computation (without saving)
      if (action === 'preview') {
        if (!period) return res.status(400).json({ error: 'period is required (YYYY-MM)' });
        const empResult = await db.execute(
          `SELECT * FROM employees WHERE is_active = 1 ORDER BY name`
        );
        const employees = empResult.rows.map((row) => ({
          id: row.id,
          name: row.name || '',
          position: row.position || '',
          homeBranch: row.home_branch || '',
          salary: Number(row.salary) || 0,
          branchCommissions: safeParseJSON(row.branch_commissions, []),
        }));

        const incomes = await loadIncomesForPeriod(period);
        const items = employees.map((emp) => {
          const { breakdown, totalCommission } = calcEmployeeCommission(emp, incomes);
          return {
            employeeId: emp.id,
            employeeName: emp.name,
            position: emp.position,
            homeBranch: emp.homeBranch,
            salary: emp.salary,
            totalCommission,
            totalAmount: emp.salary + totalCommission,
            commissionBreakdown: breakdown,
            status: 'pending',
          };
        });
        return res.status(200).json({ period, items, source: 'preview' });
      }

      // Get specific run with items
      if (runId) {
        const runResult = await db.execute({
          sql: 'SELECT * FROM payroll_runs WHERE id = ?',
          args: [runId],
        });
        if (runResult.rows.length === 0) {
          return res.status(404).json({ error: 'Payroll run not found' });
        }
        const itemsResult = await db.execute({
          sql: 'SELECT * FROM payroll_items WHERE payroll_run_id = ? ORDER BY home_branch, employee_name',
          args: [runId],
        });
        return res.status(200).json({
          run: rowToRun(runResult.rows[0]),
          items: itemsResult.rows.map(rowToItem),
        });
      }

      // Get run by period (with items)
      if (period) {
        const runResult = await db.execute({
          sql: 'SELECT * FROM payroll_runs WHERE period = ?',
          args: [period],
        });
        if (runResult.rows.length === 0) {
          return res.status(200).json({ run: null, items: [] });
        }
        const run = rowToRun(runResult.rows[0]);
        const itemsResult = await db.execute({
          sql: 'SELECT * FROM payroll_items WHERE payroll_run_id = ? ORDER BY home_branch, employee_name',
          args: [run.id],
        });
        return res.status(200).json({ run, items: itemsResult.rows.map(rowToItem) });
      }

      // List all runs
      const result = await db.execute(
        `SELECT * FROM payroll_runs ORDER BY period DESC`
      );
      return res.status(200).json({ runs: result.rows.map(rowToRun) });
    }

    // ─── POST: create or regenerate a payroll run / import legacy sales ─────────
    if (req.method === 'POST') {
      const authUser = authenticate(req);
      if (!requireAdmin(authUser)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Import legacy sales from Google Sheets `รายรับ` into a dedicated
      // `legacy_sales` table. This table is read ONLY by payroll/commission
      // calculation — it never affects stock, OrderHistory, or sales_orders.
      // Strategy: derive ID from sheet row position; wipe + re-insert each run.
      if (req.query.action === 'import-sales' || req.body?.action === 'import-sales') {
        const rows = await readLegacyIncomeSheet();
        const dataRows = rows.slice(1);
        const now = new Date().toISOString();
        const errorSamples = [];
        let errors = 0;
        let skippedEmpty = 0;

        // Step 1 — clean slate: wipe ONLY sheet-imported rows (preserve manual entries)
        // Also wipe leftover sheet-import rows in sales_orders from earliest versions.
        const wipeLegacy = await db.execute(
          `DELETE FROM legacy_sales WHERE import_source = 'sheet-import'`
        );
        const wipeOrders = await db.execute(
          `DELETE FROM sales_orders WHERE recorded_by = 'sheet-import'`
        );
        const wipedCount = (Number(wipeLegacy.rowsAffected) || 0) + (Number(wipeOrders.rowsAffected) || 0);

        // Step 2 — build INSERTs into legacy_sales using row index
        const insertSql = `INSERT INTO legacy_sales (
          id, source_row, date, channel, branch_or_platform, product_name, product_category,
          quantity, total_amount, note, import_source, recorded_by, imported_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const inserts = [];
        dataRows.forEach((row, idx) => {
          const date = parseSheetDate(row[1]);
          const total = parseFloat(row[7]) || 0;
          if (!date || total <= 0) { skippedEmpty++; return; }
          const rowNum = idx + 2; // sheet row number (1-based, +1 for header)
          const importId = `legacy_row_${rowNum}`;
          const channel = normalizeChannel(row[2]);
          const branch = String(row[3] || '').trim();
          const productName = String(row[4] || '').trim() || '(ไม่ระบุ)';
          const productCategory = String(row[5] || '').trim();
          const qty = parseInt(row[6]) || 1;
          const origNote = String(row[8] || '').trim();
          inserts.push({
            rowNum,
            stmt: {
              sql: insertSql,
              args: [importId, rowNum, date, channel, branch, productName, productCategory,
                qty, total, origNote, 'sheet-import', 'sheet-import', now],
            },
          });
        });

        // Step 3 — batch insert with per-row fallback
        let imported = 0;
        const batchSize = 100;
        for (let i = 0; i < inserts.length; i += batchSize) {
          const batch = inserts.slice(i, i + batchSize);
          try {
            await db.batch(batch.map((b) => b.stmt), 'write');
            imported += batch.length;
          } catch (batchErr) {
            for (const it of batch) {
              try {
                await db.execute(it.stmt);
                imported++;
              } catch (rowErr) {
                errors++;
                if (errorSamples.length < 5) {
                  errorSamples.push({ sheetId: `row ${it.rowNum}`, message: rowErr.message });
                }
              }
            }
          }
        }

        return res.status(200).json({
          success: true,
          totalInSheet: dataRows.length,
          wipedPrevious: wipedCount,
          skippedEmpty,
          imported,
          skipped: 0,
          errors,
          errorSamples,
        });
      }

      const { period, regenerate, note } = req.body || {};
      if (!period || !/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: 'period is required (YYYY-MM)' });
      }

      const existing = await db.execute({
        sql: 'SELECT * FROM payroll_runs WHERE period = ?',
        args: [period],
      });

      if (existing.rows.length > 0 && !regenerate) {
        return res.status(409).json({
          error: 'Payroll run already exists for this period',
          run: rowToRun(existing.rows[0]),
        });
      }

      if (existing.rows.length > 0 && existing.rows[0].status === 'finalized') {
        return res.status(409).json({
          error: 'Cannot regenerate a finalized payroll run',
        });
      }

      // Load active employees and incomes for the period
      const empResult = await db.execute(
        `SELECT * FROM employees WHERE is_active = 1 ORDER BY name`
      );
      const employees = empResult.rows.map((row) => ({
        id: row.id,
        name: row.name || '',
        position: row.position || '',
        homeBranch: row.home_branch || '',
        salary: Number(row.salary) || 0,
        branchCommissions: safeParseJSON(row.branch_commissions, []),
      }));

      const incomes = await loadIncomesForPeriod(period);
      const now = new Date().toISOString();
      const runId = existing.rows.length > 0 ? existing.rows[0].id : `prun_${Date.now()}`;

      // Compute items
      const computed = employees.map((emp) => {
        const { breakdown, totalCommission } = calcEmployeeCommission(emp, incomes);
        return {
          id: `pitem_${runId}_${emp.id}`,
          employee: emp,
          totalCommission,
          breakdown,
          totalAmount: emp.salary + totalCommission,
        };
      });

      const totalSalary = computed.reduce((s, c) => s + c.employee.salary, 0);
      const totalCommission = computed.reduce((s, c) => s + c.totalCommission, 0);
      const totalAmount = totalSalary + totalCommission;

      if (existing.rows.length > 0) {
        // Regenerate: preserve paid status + adjustments by employee_id
        const existingItems = await db.execute({
          sql: 'SELECT * FROM payroll_items WHERE payroll_run_id = ?',
          args: [runId],
        });
        const byEmp = new Map();
        for (const r of existingItems.rows) byEmp.set(r.employee_id, r);

        await db.execute({ sql: 'DELETE FROM payroll_items WHERE payroll_run_id = ?', args: [runId] });

        for (const c of computed) {
          const prev = byEmp.get(c.employee.id);
          const adjustment = prev ? Number(prev.adjustment) || 0 : 0;
          const adjustmentNote = prev ? prev.adjustment_note || '' : '';
          const status = prev ? prev.status : 'pending';
          const paidAt = prev ? prev.paid_at || '' : '';
          const paidBy = prev ? prev.paid_by || '' : '';
          const paidMethod = prev ? prev.paid_method || '' : '';
          const itemNote = prev ? prev.note || '' : '';
          const finalAmount = c.employee.salary + c.totalCommission + adjustment;
          await db.execute({
            sql: `INSERT INTO payroll_items (
              id, payroll_run_id, employee_id, employee_name, position, home_branch,
              salary, total_commission, total_amount, commission_breakdown,
              adjustment, adjustment_note, status, paid_at, paid_by, paid_method, note,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              c.id, runId, c.employee.id, c.employee.name, c.employee.position, c.employee.homeBranch,
              c.employee.salary, c.totalCommission, finalAmount, JSON.stringify(c.breakdown),
              adjustment, adjustmentNote, status, paidAt, paidBy, paidMethod, itemNote,
              prev ? prev.created_at : now, now,
            ],
          });
        }

        await db.execute({
          sql: `UPDATE payroll_runs SET total_salary = ?, total_commission = ?, total_amount = ?,
            employee_count = ?, note = ?, updated_at = ? WHERE id = ?`,
          args: [totalSalary, totalCommission, totalAmount, computed.length,
            note ?? existing.rows[0].note ?? '', now, runId],
        });
      } else {
        await db.execute({
          sql: `INSERT INTO payroll_runs (
            id, period, status, total_salary, total_commission, total_amount,
            employee_count, note, created_by, created_at, updated_at
          ) VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [runId, period, totalSalary, totalCommission, totalAmount,
            computed.length, note || '', authUser?.name || '', now, now],
        });

        for (const c of computed) {
          await db.execute({
            sql: `INSERT INTO payroll_items (
              id, payroll_run_id, employee_id, employee_name, position, home_branch,
              salary, total_commission, total_amount, commission_breakdown,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              c.id, runId, c.employee.id, c.employee.name, c.employee.position, c.employee.homeBranch,
              c.employee.salary, c.totalCommission, c.totalAmount, JSON.stringify(c.breakdown),
              now, now,
            ],
          });
        }
      }

      const run = await db.execute({ sql: 'SELECT * FROM payroll_runs WHERE id = ?', args: [runId] });
      const items = await db.execute({
        sql: 'SELECT * FROM payroll_items WHERE payroll_run_id = ? ORDER BY home_branch, employee_name',
        args: [runId],
      });

      return res.status(200).json({
        success: true,
        run: rowToRun(run.rows[0]),
        items: items.rows.map(rowToItem),
        regenerated: existing.rows.length > 0,
      });
    }

    // ─── PUT: update item (mark paid, adjust, etc.) or finalize run ─
    if (req.method === 'PUT') {
      const authUser = authenticate(req);
      if (!requireAdmin(authUser)) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { itemId, runId, action, updates } = req.body || {};
      const now = new Date().toISOString();

      // Finalize a run
      if (action === 'finalize' && runId) {
        await db.execute({
          sql: `UPDATE payroll_runs SET status = 'finalized', finalized_at = ?, finalized_by = ?, updated_at = ? WHERE id = ?`,
          args: [now, authUser?.name || '', now, runId],
        });
        return res.status(200).json({ success: true });
      }

      // Reopen a run
      if (action === 'reopen' && runId) {
        await db.execute({
          sql: `UPDATE payroll_runs SET status = 'draft', finalized_at = '', finalized_by = '', updated_at = ? WHERE id = ?`,
          args: [now, runId],
        });
        return res.status(200).json({ success: true });
      }

      // Update payroll_item
      if (itemId && updates) {
        const itemResult = await db.execute({
          sql: 'SELECT * FROM payroll_items WHERE id = ?',
          args: [itemId],
        });
        if (itemResult.rows.length === 0) {
          return res.status(404).json({ error: 'Payroll item not found' });
        }
        const current = itemResult.rows[0];

        const sets = [];
        const args = [];

        if (updates.status !== undefined) {
          sets.push('status = ?');
          args.push(updates.status);
          if (updates.status === 'paid') {
            sets.push('paid_at = ?', 'paid_by = ?');
            args.push(now, authUser?.name || '');
            if (updates.paidMethod !== undefined) {
              sets.push('paid_method = ?');
              args.push(updates.paidMethod);
            }
          } else if (updates.status === 'pending') {
            sets.push('paid_at = ?', 'paid_by = ?', 'paid_method = ?');
            args.push('', '', '');
          }
        }

        if (updates.adjustment !== undefined || updates.adjustmentNote !== undefined) {
          const adjustment = updates.adjustment !== undefined
            ? Number(updates.adjustment) || 0
            : Number(current.adjustment) || 0;
          const adjustmentNote = updates.adjustmentNote !== undefined
            ? updates.adjustmentNote
            : current.adjustment_note || '';
          sets.push('adjustment = ?', 'adjustment_note = ?');
          args.push(adjustment, adjustmentNote);
          // Recompute total_amount
          const newTotal = (Number(current.salary) || 0) + (Number(current.total_commission) || 0) + adjustment;
          sets.push('total_amount = ?');
          args.push(newTotal);
        }

        if (updates.note !== undefined) {
          sets.push('note = ?');
          args.push(updates.note);
        }

        if (sets.length === 0) {
          return res.status(400).json({ error: 'No valid fields to update' });
        }

        sets.push('updated_at = ?');
        args.push(now);
        args.push(itemId);

        await db.execute({
          sql: `UPDATE payroll_items SET ${sets.join(', ')} WHERE id = ?`,
          args,
        });

        // Recalculate run totals
        const runIdResult = current.payroll_run_id;
        const totalsResult = await db.execute({
          sql: `SELECT
            COALESCE(SUM(salary), 0) AS ts,
            COALESCE(SUM(total_commission), 0) AS tc,
            COALESCE(SUM(total_amount), 0) AS ta,
            COUNT(*) AS cnt
            FROM payroll_items WHERE payroll_run_id = ?`,
          args: [runIdResult],
        });
        const t = totalsResult.rows[0];
        await db.execute({
          sql: `UPDATE payroll_runs SET total_salary = ?, total_commission = ?, total_amount = ?,
            employee_count = ?, updated_at = ? WHERE id = ?`,
          args: [Number(t.ts) || 0, Number(t.tc) || 0, Number(t.ta) || 0, Number(t.cnt) || 0, now, runIdResult],
        });

        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Missing itemId/runId or action' });
    }

    // ─── DELETE: delete a run (and its items) ─
    if (req.method === 'DELETE') {
      const authUser = authenticate(req);
      if (!requireAdmin(authUser)) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { runId } = req.query;
      if (!runId) return res.status(400).json({ error: 'runId is required' });

      const runResult = await db.execute({
        sql: 'SELECT status FROM payroll_runs WHERE id = ?',
        args: [runId],
      });
      if (runResult.rows.length === 0) {
        return res.status(404).json({ error: 'Payroll run not found' });
      }
      if (runResult.rows[0].status === 'finalized') {
        return res.status(409).json({ error: 'Cannot delete a finalized run. Reopen it first.' });
      }

      await db.execute({ sql: 'DELETE FROM payroll_items WHERE payroll_run_id = ?', args: [runId] });
      await db.execute({ sql: 'DELETE FROM payroll_runs WHERE id = ?', args: [runId] });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Payroll API error:', error);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}
