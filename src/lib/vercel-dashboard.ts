// Dashboard data adapter — reads income (sales_orders + legacy_sales) and
// expenses from Turso, and maps them to the Income[] / Expense[] shape used
// by the dashboard so existing components don't need to change.

import { Income, Expense } from '@/types';

const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// Fetch sales (real + legacy) and project to Income[] for dashboard
export async function getIncomeData(): Promise<Income[]> {
  const res = await fetch(`${API_BASE}/sales?include_legacy=true&limit=50000`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch income data');
  const json = await res.json();
  const rows: any[] = json.data || [];

  return rows.map((r): Income => ({
    id: r.id,
    date: r.date,
    channel: (r.channel || 'store') as Income['channel'],
    branch_or_platform: r.branch_or_platform || '',
    note: r.note || '',
    product_name: r.product_name || '',
    product_category: r.product_category || '(ไม่ระบุ)',
    quantity: Number(r.quantity) || 0,
    amount: Number(r.total_amount) || 0,
    createdAt: r.created_at || r.imported_at || r.date,
    updatedAt: r.created_at || r.imported_at || r.date,
  }));
}

// Fetch expenses from Turso and project to Expense[]
export async function getExpenseData(): Promise<Expense[]> {
  const res = await fetch(`${API_BASE}/expenses?limit=50000`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error('Failed to fetch expense data');
  const json = await res.json();
  const rows: any[] = json.data || [];

  return rows.map((r): Expense => ({
    id: r.id,
    date: r.date,
    channel: (r.channel || 'store') as Expense['channel'],
    branch_or_platform: r.branch_or_platform || '',
    note: r.note || '',
    expense_item: r.expense_item || '',
    expense_category: r.expense_category || '(ไม่ระบุ)',
    cost: Number(r.cost) || 0,
    createdAt: r.created_at || r.date,
    updatedAt: r.updated_at || r.created_at || r.date,
  }));
}

// Manual income from Add Record form → writes to legacy_sales (import_source='manual')
export async function addIncomeRecord(
  income: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const res = await fetch(`${API_BASE}/sales?action=manual-income`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      action: 'manual-income',
      date: income.date,
      channel: income.channel,
      branch_or_platform: income.branch_or_platform,
      product_name: income.product_name,
      product_category: income.product_category,
      quantity: income.quantity,
      total_amount: income.amount,
      note: income.note || '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add income');
  }
}

// Manual expense → writes to expenses table
export async function addExpenseRecord(
  expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const res = await fetch(`${API_BASE}/expenses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      date: expense.date,
      channel: expense.channel,
      branch_or_platform: expense.branch_or_platform,
      expense_item: expense.expense_item,
      expense_category: expense.expense_category,
      cost: expense.cost,
      note: expense.note || '',
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add expense');
  }
}

// No-op — Turso schema is auto-initialized server-side on every request
export async function initializeSheets(): Promise<void> {
  return;
}

export const getConfigurationStatus = () => ({
  isConfigured: true,
  apiBase: API_BASE,
  source: 'turso',
});
