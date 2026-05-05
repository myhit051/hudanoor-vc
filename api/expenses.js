import { google } from 'googleapis';
import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate, requireAdmin } from '../lib/auth-middleware.js';
import { parseSheetDate } from '../lib/sheet-date.js';

async function readLegacyExpenseSheet() {
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
    range: 'รายจ่าย!A:J',
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    // GET /api/expenses — list (optional date_from, date_to, q)
    if (req.method === 'GET') {
      const { action, date_from, date_to, limit = 5000, offset = 0 } = req.query;

      // Preview legacy expense import
      if (action === 'import-expenses-preview') {
        const rows = await readLegacyExpenseSheet();
        const dataRows = rows.slice(1);
        let validRows = 0;
        let skippedEmpty = 0;
        for (const row of dataRows) {
          const cost = parseFloat(row[6]) || 0;
          const date = parseSheetDate(row[1]);
          if (!date || cost <= 0) skippedEmpty++;
          else validRows++;
        }
        const prev = await db.execute(
          `SELECT COUNT(*) AS c FROM expenses WHERE import_source = 'sheet-import'`
        );
        return res.status(200).json({
          totalInSheet: dataRows.length,
          validRows,
          skippedEmpty,
          previousImports: Number(prev.rows[0]?.c) || 0,
          willImport: validRows,
        });
      }

      let query = 'SELECT * FROM expenses WHERE 1=1';
      const args = [];
      if (date_from) { query += ' AND date >= ?'; args.push(date_from); }
      if (date_to) { query += ' AND date <= ?'; args.push(date_to); }
      query += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
      args.push(Number(limit), Number(offset));

      const result = await db.execute({ sql: query, args });
      return res.status(200).json({ data: result.rows });
    }

    // POST — create new expense, OR import legacy expenses from Sheet
    if (req.method === 'POST') {
      const authUser = authenticate(req);

      // Import legacy expenses from Google Sheets `รายจ่าย`
      if (req.query.action === 'import-expenses' || req.body?.action === 'import-expenses') {
        if (!requireAdmin(authUser)) {
          return res.status(403).json({ error: 'Admin access required' });
        }
        const rows = await readLegacyExpenseSheet();
        const dataRows = rows.slice(1);
        const now = new Date().toISOString();
        const errorSamples = [];
        let errors = 0;
        let skippedEmpty = 0;

        // Wipe only sheet-imported rows (preserve manual)
        const wipe = await db.execute(
          `DELETE FROM expenses WHERE import_source = 'sheet-import'`
        );
        const wipedCount = Number(wipe.rowsAffected) || 0;

        const insertSql = `INSERT INTO expenses (
          id, date, channel, branch_or_platform, expense_item, expense_category,
          cost, note, import_source, source_row, recorded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const inserts = [];
        dataRows.forEach((row, idx) => {
          const date = parseSheetDate(row[1]);
          const cost = parseFloat(row[6]) || 0;
          if (!date || cost <= 0) { skippedEmpty++; return; }
          const rowNum = idx + 2;
          const importId = `legacy_exp_row_${rowNum}`;
          const channel = normalizeChannel(row[2]);
          const branch = String(row[3] || '').trim();
          const expenseItem = String(row[4] || '').trim() || '(ไม่ระบุ)';
          const expenseCategory = String(row[5] || '').trim();
          const origNote = String(row[7] || '').trim();
          inserts.push({
            rowNum,
            stmt: {
              sql: insertSql,
              args: [importId, date, channel, branch, expenseItem, expenseCategory,
                cost, origNote, 'sheet-import', rowNum, 'sheet-import', now, now],
            },
          });
        });

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
          errors,
          errorSamples,
        });
      }

      // Manual create
      const expenseData = req.body || {};
      if (!expenseData.expense_item || !expenseData.cost) {
        return res.status(400).json({
          error: 'Missing required fields: expense_item, cost'
        });
      }

      const id = `expense_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();
      const recordedBy = authUser ? authUser.name : '';

      await db.execute({
        sql: `INSERT INTO expenses (
          id, date, channel, branch_or_platform, expense_item, expense_category,
          cost, note, import_source, recorded_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, ?)`,
        args: [
          id,
          expenseData.date || now.split('T')[0],
          expenseData.channel || 'store',
          expenseData.branch_or_platform || '',
          expenseData.expense_item,
          expenseData.expense_category || '',
          Number(expenseData.cost) || 0,
          expenseData.note || '',
          recordedBy,
          now,
          now,
        ],
      });

      return res.status(201).json({ success: true, id });
    }

    // DELETE /api/expenses?id=xxx — delete (admin or creator)
    if (req.method === 'DELETE') {
      const authUser = authenticate(req);
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const result = await db.execute({
        sql: 'SELECT recorded_by, import_source FROM expenses WHERE id = ?',
        args: [id],
      });
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'ไม่พบรายการ' });
      }
      const row = result.rows[0];
      if (row.import_source === 'sheet-import' && authUser.role !== 'admin') {
        return res.status(403).json({ error: 'รายการที่นำเข้าจาก Sheet ลบได้เฉพาะ Admin' });
      }
      if (row.import_source !== 'sheet-import' &&
          authUser.role !== 'admin' && authUser.name !== row.recorded_by) {
        return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบรายการนี้' });
      }

      await db.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [id] });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Expenses API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
