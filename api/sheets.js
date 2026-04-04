import { google } from 'googleapis';

function getAuth(readonly = false) {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
    },
    scopes: readonly
      ? ['https://www.googleapis.com/auth/spreadsheets.readonly']
      : ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const action = req.query.action;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.GOOGLE_SHEETS_ID;

  if (!spreadsheetId) {
    return res.status(500).json({ error: 'Spreadsheet ID not configured' });
  }

  // READ — GET /api/sheets?action=read&range=Sheet1!A:Z
  if (action === 'read') {
    if (req.method !== 'GET') return res.status(405).json({ message: 'Method not allowed' });

    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, '');

    if (!clientEmail || !privateKey) {
      return res.status(500).json({ error: 'Missing required environment variables' });
    }

    try {
      const sheets = google.sheets({ version: 'v4', auth: getAuth(true) });
      const range = req.query.range || 'Sheet1!A:Z';
      const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      return res.status(200).json({
        data: response.data.values || [],
        range: response.data.range,
        majorDimension: response.data.majorDimension,
      });
    } catch (error) {
      console.error('Sheets read error:', error);
      return res.status(500).json({ error: 'Failed to read sheet data', details: error.message });
    }
  }

  // WRITE (append) — POST /api/sheets?action=write
  if (action === 'write') {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const { range, values } = req.body;
    if (!range || !values) return res.status(400).json({ error: 'Range and values are required' });

    try {
      const sheets = google.sheets({ version: 'v4', auth: getAuth() });
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: Array.isArray(values[0]) ? values : [values] },
      });
      return res.status(200).json({
        success: true,
        updatedRows: response.data.updates.updatedRows,
        updatedRange: response.data.updates.updatedRange,
      });
    } catch (error) {
      console.error('Sheets write error:', error);
      return res.status(500).json({ error: 'Failed to write to sheet', details: error.message });
    }
  }

  // UPDATE — POST or PUT /api/sheets?action=update
  if (action === 'update') {
    if (req.method !== 'POST' && req.method !== 'PUT') return res.status(405).json({ message: 'Method not allowed' });

    const { range, values } = req.body;
    if (!range || !values) return res.status(400).json({ error: 'Range and values are required' });

    try {
      const sheets = google.sheets({ version: 'v4', auth: getAuth() });
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values: Array.isArray(values[0]) ? values : [values] },
      });
      return res.status(200).json({
        success: true,
        updatedCells: response.data.updatedCells,
        updatedRows: response.data.updatedRows,
        updatedColumns: response.data.updatedColumns,
        updatedRange: response.data.updatedRange,
      });
    } catch (error) {
      console.error('Sheets update error:', error);
      return res.status(500).json({ error: 'Failed to update sheet', details: error.message });
    }
  }

  return res.status(400).json({ error: 'Missing or invalid action. Use ?action=read|write|update' });
}
