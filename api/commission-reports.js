import { google } from 'googleapis';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
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

    // Handle GET request (generate commission reports)
    if (req.method === 'GET') {
      const { period } = req.query; // Format: YYYY-MM
      
      try {
        // Get employees data
        const employeesResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'Employees!A:I',
        });
        
        // Get income data
        const incomeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: 'รายรับ!A:K',
        });

        const employeesData = employeesResponse.data.values || [];
        const incomeData = incomeResponse.data.values || [];

        // Parse employees
        const employees = employeesData.slice(1).filter(row => row[0] && row[0].trim() !== '').map((row, index) => {
          // Debug: Log salary data for troubleshooting
          if (index === 0) {
            console.log('Commission Reports - Sample employee data:');
            console.log('Raw salary value:', row[6], 'Type:', typeof row[6]);
          }
          let branchCommissions = [];
          try {
            if (row[8] && typeof row[8] === 'string') {
              branchCommissions = JSON.parse(row[8]);
            }
          } catch (error) {
            console.warn('Failed to parse branch commissions:', error);
          }
          
          return {
            id: row[0],
            name: row[1] || '',
            position: row[2] || '',
            email: row[3] || '',
            phone: row[4] || '',
            startDate: row[5] || '',
            salary: (() => {
              const salaryValue = row[6];
              let parsed = 0;
              
              if (salaryValue === null || salaryValue === undefined || salaryValue === '') {
                return 0;
              }
              
              if (typeof salaryValue === 'string') {
                // Remove commas, currency symbols, whitespace, and other formatting
                let cleanValue = salaryValue.replace(/[,฿$\s\u00A0\u2000-\u200B\u2028\u2029]/g, '');
                
                // Handle decimal points
                if (cleanValue.includes('.')) {
                  parsed = parseFloat(cleanValue);
                } else {
                  parsed = parseInt(cleanValue, 10);
                }
              } else if (typeof salaryValue === 'number') {
                parsed = salaryValue;
              } else {
                // Try to convert to string first, then parse
                const stringValue = String(salaryValue);
                const cleanValue = stringValue.replace(/[,฿$\s\u00A0\u2000-\u200B\u2028\u2029]/g, '');
                parsed = parseFloat(cleanValue);
              }
              
              // Validate the result
              if (isNaN(parsed) || !isFinite(parsed)) {
                console.warn(`Invalid salary value for employee: "${salaryValue}" (type: ${typeof salaryValue})`);
                return 0;
              }
              
              return parsed;
            })(),
            isActive: row[7] === 'active',
            branchCommissions: Array.isArray(branchCommissions) ? branchCommissions : []
          };
        });

        // Parse income data
        const incomes = incomeData.slice(1).filter(row => row[0] && row[0].trim() !== '').map(row => ({
          id: row[0],
          date: row[1],
          channel: row[2] || 'store',
          branchOrPlatform: row[3] || '',
          productName: row[4] || '',
          productCategory: row[5] || '',
          quantity: parseInt(row[6]) || 1,
          totalAmount: parseFloat(row[7]) || 0,
          note: row[8] || '',
          createdAt: row[9] || '',
          updatedAt: row[10] || ''
        }));

        // Filter income by period if specified
        let filteredIncomes = incomes;
        if (period) {
          filteredIncomes = incomes.filter(income => {
            if (!income.date) return false;
            const incomeMonth = income.date.substring(0, 7); // YYYY-MM
            return incomeMonth === period;
          });
        }

        // Calculate commission reports for each active employee
        const commissionReports = employees
          .filter(employee => employee.isActive)
          .map(employee => {
            let storeSales = 0;
            let onlineSales = 0;
            let storeCommission = 0;
            let onlineCommission = 0;

            // Calculate sales and commissions for each branch/platform
            employee.branchCommissions.forEach(commission => {
              const salesForBranch = filteredIncomes
                .filter(income => 
                  income.channel === commission.channel && 
                  income.branchOrPlatform === commission.branchOrPlatform
                )
                .reduce((sum, income) => sum + income.totalAmount, 0);

              const commissionAmount = salesForBranch * (commission.commissionRate / 100);

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
              period: period || new Date().toISOString().substring(0, 7),
              storeSales,
              onlineSales,
              storeCommission,
              onlineCommission,
              totalCommission,
              salary: employee.salary,
              totalEarnings,
              branchCommissions: employee.branchCommissions
            };
          });

        return res.status(200).json({ 
          success: true,
          data: commissionReports,
          period: period || new Date().toISOString().substring(0, 7),
          totalEmployees: commissionReports.length,
          totalCommissions: commissionReports.reduce((sum, report) => sum + report.totalCommission, 0)
        });

      } catch (error) {
        console.error('Error generating commission reports:', error);
        return res.status(500).json({ 
          error: 'Failed to generate commission reports',
          details: error.message 
        });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Commission Reports API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to process request',
      details: error.message 
    });
  }
}