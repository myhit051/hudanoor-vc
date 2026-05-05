import { google } from 'googleapis';
import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate, requireAdmin } from '../lib/auth-middleware.js';

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

// Calculate commission breakdown for an employee given the income rows
function calcEmployeeCommission(employee, incomes) {
  const breakdown = (employee.branchCommissions || []).map((commission) => {
    const salesForBranch = incomes
      .filter((income) =>
        income.channel === commission.channel &&
        income.branchOrPlatform === commission.branchOrPlatform
      )
      .reduce((sum, income) => sum + income.totalAmount, 0);
    const rate = Number(commission.commissionRate) || 0;
    const commissionAmount = salesForBranch * (rate / 100);
    return {
      channel: commission.channel,
      branchOrPlatform: commission.branchOrPlatform,
      sales: salesForBranch,
      rate,
      commission: commissionAmount,
    };
  });
  const totalCommission = breakdown.reduce((s, b) => s + b.commission, 0);
  return { breakdown, totalCommission };
}

async function loadIncomesForPeriod(period) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID;
  if (!spreadsheetId) throw new Error('Spreadsheet ID not configured');

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'รายรับ!A:K',
  });
  const rows = response.data.values || [];
  const incomes = rows.slice(1)
    .filter((row) => row[0] && String(row[0]).trim() !== '')
    .map((row) => ({
      id: row[0],
      date: row[1],
      channel: row[2] || 'store',
      branchOrPlatform: row[3] || '',
      totalAmount: parseFloat(row[7]) || 0,
    }));
  return incomes.filter((i) => i.date && String(i.date).substring(0, 7) === period);
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

    // ─── POST: create or regenerate a payroll run ─────────
    if (req.method === 'POST') {
      const authUser = authenticate(req);
      if (!requireAdmin(authUser)) {
        return res.status(403).json({ error: 'Admin access required' });
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
