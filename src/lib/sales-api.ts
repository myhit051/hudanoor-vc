const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

export interface SalesOrder {
  id: string;
  date: string;
  channel: string;
  branch_or_platform: string;
  sku: string;
  product_name: string;
  color: string;
  size: string;
  quantity: number;
  unit_price: number;
  discount_type: 'amount' | 'percent';
  discount_value: number;
  discount_amount: number;
  final_unit_price: number;
  total_amount: number;
  note: string;
  stock_in_id: string;
  created_at: string;
}

export type NewSalesOrder = Omit<SalesOrder, 'id' | 'created_at' | 'discount_amount' | 'final_unit_price' | 'total_amount'>;

export async function getSalesOrders(params?: {
  date?: string;
  sku?: string;
  channel?: string;
}): Promise<SalesOrder[]> {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  if (params?.sku) query.set('sku', params.sku);
  if (params?.channel) query.set('channel', params.channel);

  const res = await fetch(`${API_BASE}/sales?${query}`);
  if (!res.ok) throw new Error('Failed to fetch sales');
  const data = await res.json();
  return data.data as SalesOrder[];
}

export async function addSalesOrder(order: NewSalesOrder): Promise<void> {
  const res = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add sale');
  }
}

export async function deleteSalesOrder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sales?id=${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete sale');
  }
}
