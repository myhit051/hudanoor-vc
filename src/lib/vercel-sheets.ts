import { Income, Expense } from '@/types';

// API base URL - automatically detects environment
const API_BASE = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

// Sheet names
const INCOME_SHEET = 'รายรับ';
const EXPENSE_SHEET = 'รายจ่าย';

// Helper function to convert sheet data to Income objects
const parseIncomeData = (rows: any[][]): Income[] => {
  if (!rows || rows.length <= 1) return [];
  
  // Skip header row
  return rows.slice(1).map((row, index) => ({
    id: row[0] || `income_${index + 1}`,
    date: row[1] || new Date().toISOString(),
    channel: row[2] || 'store',
    branch_or_platform: row[3] || '',
    product_name: row[4] || '',
    product_category: row[5] || '',
    quantity: parseInt(row[6]) || 0,
    amount: parseFloat(row[7]) || 0,
    note: row[8] || '',
    createdAt: row[9] || new Date().toISOString(),
    updatedAt: row[10] || new Date().toISOString()
  }));
};

// Helper function to convert sheet data to Expense objects
const parseExpenseData = (rows: any[][]): Expense[] => {
  if (!rows || rows.length <= 1) return [];
  
  // Skip header row
  return rows.slice(1).map((row, index) => ({
    id: row[0] || `expense_${index + 1}`,
    date: row[1] || new Date().toISOString(),
    channel: row[2] || 'store',
    branch_or_platform: row[3] || '',
    expense_item: row[4] || '',
    expense_category: row[5] || '',
    cost: parseFloat(row[6]) || 0,
    note: row[7] || '',
    createdAt: row[8] || new Date().toISOString(),
    updatedAt: row[9] || new Date().toISOString()
  }));
};

// Read income data from Google Sheets via Vercel API
export const getIncomeData = async (): Promise<Income[]> => {
  try {
    const response = await fetch(`${API_BASE}/sheets?action=read&range=${encodeURIComponent(INCOME_SHEET)}!A:K`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return parseIncomeData(data.data || []);
  } catch (error) {
    console.error('Error fetching income data:', error);
    throw error;
  }
};

// Read expense data from Google Sheets via Vercel API
export const getExpenseData = async (): Promise<Expense[]> => {
  try {
    const response = await fetch(`${API_BASE}/sheets?action=read&range=${encodeURIComponent(EXPENSE_SHEET)}!A:J`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return parseExpenseData(data.data || []);
  } catch (error) {
    console.error('Error fetching expense data:', error);
    throw error;
  }
};

// Add new income record via Vercel API
export const addIncomeRecord = async (income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const id = `income_${Date.now()}`;
    const now = new Date().toISOString();
    
    const values = [
      id,
      income.date,
      income.channel,
      income.branch_or_platform,
      income.product_name,
      income.product_category,
      income.quantity,
      income.amount,
      income.note || '',
      now,
      now
    ];

    const response = await fetch(`${API_BASE}/sheets?action=write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${INCOME_SHEET}!A:K`,
        values: [values]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('Income record added successfully via Vercel API');
  } catch (error) {
    console.error('Error adding income record:', error);
    throw error;
  }
};

// Add new expense record via Vercel API
export const addExpenseRecord = async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const id = `expense_${Date.now()}`;
    const now = new Date().toISOString();
    
    const values = [
      id,
      expense.date,
      expense.channel,
      expense.branch_or_platform,
      expense.expense_item,
      expense.expense_category,
      expense.cost,
      expense.note || '',
      now,
      now
    ];

    const response = await fetch(`${API_BASE}/sheets?action=write`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${EXPENSE_SHEET}!A:J`,
        values: [values]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    console.log('Expense record added successfully via Vercel API');
  } catch (error) {
    console.error('Error adding expense record:', error);
    throw error;
  }
};

// Initialize sheets with headers if they don't exist
export const initializeSheets = async (): Promise<void> => {
  try {
    // Income sheet headers
    const incomeHeaders = [
      'ID', 'วันที่', 'ช่องทาง', 'สาขา/แพลตฟอร์ม', 'ชื่อสินค้า', 
      'หมวดหมู่สินค้า', 'จำนวน', 'ยอดเงิน', 'หมายเหตุ', 'สร้างเมื่อ', 'แก้ไขเมื่อ'
    ];

    // Expense sheet headers
    const expenseHeaders = [
      'ID', 'วันที่', 'ช่องทาง', 'สาขา/แพลตฟอร์ม', 'รายการค่าใช้จ่าย', 
      'หมวดหมู่ค่าใช้จ่าย', 'ยอดเงิน', 'หมายเหตุ', 'สร้างเมื่อ', 'แก้ไขเมื่อ'
    ];

    // Initialize income sheet
    const incomeResponse = await fetch(`${API_BASE}/sheets?action=update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${INCOME_SHEET}!A1:K1`,
        values: [incomeHeaders]
      })
    });

    if (!incomeResponse.ok) {
      const errorData = await incomeResponse.json();
      throw new Error(`Failed to initialize income sheet: ${errorData.error}`);
    }

    // Initialize expense sheet
    const expenseResponse = await fetch(`${API_BASE}/sheets?action=update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range: `${EXPENSE_SHEET}!A1:J1`,
        values: [expenseHeaders]
      })
    });

    if (!expenseResponse.ok) {
      const errorData = await expenseResponse.json();
      throw new Error(`Failed to initialize expense sheet: ${errorData.error}`);
    }

    console.log('Google Sheets initialized successfully via Vercel API');
  } catch (error) {
    console.error('Error initializing sheets:', error);
    throw new Error('Failed to initialize Google Sheets');
  }
};

// Check API health
export const checkApiHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch (error) {
    console.error('API health check failed:', error);
    return false;
  }
};

// Create income record from Task Reminder format
export const createIncomeRecord = async (incomeData: {
  date: string;
  product_name: string;
  product_category?: string;
  price: number;
  quantity?: number;
  total_amount?: number;
  channel?: string;
  branch_or_platform?: string;
  note?: string;
}): Promise<void> => {
  const income = {
    date: incomeData.date,
    channel: incomeData.channel || 'store',
    branch_or_platform: incomeData.branch_or_platform || '',
    product_name: incomeData.product_name,
    product_category: incomeData.product_category || '',
    quantity: incomeData.quantity || 1,
    amount: incomeData.total_amount || incomeData.price,
    note: incomeData.note || ''
  };

  return addIncomeRecord(income);
};

// Create expense record from Task Reminder format
export const createExpenseRecord = async (expenseData: {
  date: string;
  expense_item: string;
  expense_category?: string;
  cost: number;
  channel?: string;
  branch_or_platform?: string;
  note?: string;
}): Promise<void> => {
  const expense = {
    date: expenseData.date,
    channel: expenseData.channel || 'store',
    branch_or_platform: expenseData.branch_or_platform || '',
    expense_item: expenseData.expense_item,
    expense_category: expenseData.expense_category || '',
    cost: expenseData.cost,
    note: expenseData.note || ''
  };

  return addExpenseRecord(expense);
};

// Export configuration status
export const getConfigurationStatus = () => {
  return {
    isConfigured: true, // Vercel API handles configuration
    apiBase: API_BASE,
    environment: typeof window !== 'undefined' ? 'client' : 'server'
  };
};