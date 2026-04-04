const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

export interface StockItem {
  id: string;
  date: string;
  sku: string;
  product_name: string;
  color: string;
  size: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
  note: string;
  created_at: string;
  updated_at: string;
}

export type NewStockItem = Omit<StockItem, 'id' | 'created_at' | 'updated_at'>;

export async function getStockItems(params?: { date?: string; sku?: string }): Promise<StockItem[]> {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  if (params?.sku) query.set('sku', params.sku);

  const res = await fetch(`${API_BASE}/stock?${query}`);
  if (!res.ok) throw new Error('Failed to fetch stock');
  const data = await res.json();
  return data.data as StockItem[];
}

export async function addStockItem(item: NewStockItem): Promise<void> {
  const res = await fetch(`${API_BASE}/stock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add stock');
  }
}

export async function deleteStockItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stock?id=${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete stock');
}
