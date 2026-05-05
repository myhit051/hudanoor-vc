import { google } from 'googleapis';
import { getTursoClient, initSchema } from '../lib/turso.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initSchema();
    const db = getTursoClient();

    const { period } = req.query; // YYYY-MM

    // 1. Read active employees from Turso
    const employeesResult = await db.execute(
      `SELECT id, name, position, salary, branch_commissions, home_branch
       FROM employees WHERE is_active = 1 ORDER BY name`
    );
    const employees = employeesResult.rows.map((row) => ({
      id: row.id,
      name: row.name || '',
      position: row.position || '',
      salary: Number(row.salary) || 0,
      homeBranch: row.home_branch || '',
      branchCommissions: safeParseJSON(row.branch_commissions, []),
    }));

    // 2. Read income (sales) from Google Sheets — keep existing behaviour
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return res.status(500).json({ error: 'Spreadsheet ID not configured' });
    }

    const incomeResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'รายรับ!A:K',
    });
    const incomeData = incomeResponse.data.values || [];
    const incomes = incomeData.slice(1).filter((row) => row[0] && String(row[0]).trim() !== '').map((row) => ({
      id: row[0],
      date: row[1],
      channel: row[2] || 'store',
      branchOrPlatform: row[3] || '',
      productName: row[4] || '',
      productCategory: row[5] || '',
      quantity: parseInt(row[6]) || 1,
      totalAmount: parseFloat(row[7]) || 0,
    }));

    let filteredIncomes = incomes;
    if (period) {
      filteredIncomes = incomes.filter((income) => {
        if (!income.date) return false;
        const incomeMonth = String(income.date).substring(0, 7);
        return incomeMonth === period;
      });
    }

    // 3. Calculate commission per employee
    const commissionReports = employees.map((employee) => {
      let storeSales = 0;
      let onlineSales = 0;
      let storeCommission = 0;
      let onlineCommission = 0;

      employee.branchCommissions.forEach((commission) => {
        const salesForBranch = filteredIncomes
          .filter((income) =>
            income.channel === commission.channel &&
            income.branchOrPlatform === commission.branchOrPlatform
          )
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
      const totalEarnings = employee.salary + totalCommission;

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
        totalEarnings,
        branchCommissions: employee.branchCommissions,
      };
    });

    return res.status(200).json({
      success: true,
      data: commissionReports,
      period: period || new Date().toISOString().substring(0, 7),
      totalEmployees: commissionReports.length,
      totalCommissions: commissionReports.reduce((sum, r) => sum + r.totalCommission, 0),
    });
  } catch (error) {
    console.error('Commission Reports API Error:', error);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}
