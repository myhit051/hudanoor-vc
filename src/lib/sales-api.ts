const API_BASE = typeof window !== 'undefined'
  ? (window.location.hostname === 'localhost' ? 'http://localhost:3000/api' : '/api')
  : '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

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
  order_id: string;
  recorded_by: string;
  created_at: string;
}

export interface OrderSummary {
  order_id: string;
  date: string;
  channel: string;
  branch_or_platform: string;
  recorded_by: string;
  created_at: string;
  total_items: number;
  total_quantity: number;
  total_amount: number;
  items: SalesOrder[];
}

export type NewSalesOrder = Omit<SalesOrder, 'id' | 'created_at' | 'discount_amount' | 'final_unit_price' | 'total_amount' | 'order_id' | 'recorded_by'>;

export async function getSalesOrders(params?: {
  date?: string;
  sku?: string;
  channel?: string;
}): Promise<SalesOrder[]> {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  if (params?.sku) query.set('sku', params.sku);
  if (params?.channel) query.set('channel', params.channel);

  const res = await fetch(`${API_BASE}/sales?${query}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch sales');
  const data = await res.json();
  return data.data as SalesOrder[];
}

export async function addSalesOrder(order: NewSalesOrder): Promise<void> {
  const res = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(order)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add sale');
  }
}

export async function addSalesOrders(orders: NewSalesOrder[]): Promise<void> {
  const res = await fetch(`${API_BASE}/sales`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(orders)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add sales');
  }
}

export async function deleteSalesOrder(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sales?id=${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete sale');
  }
}

export function groupSalesByOrder(sales: SalesOrder[]): OrderSummary[] {
  const groups: Record<string, OrderSummary> = {};
  
  sales.forEach(sale => {
    // If no order_id, we treat it as an individual order for display purposes
    const oId = sale.order_id || `legacy-${sale.id}`;
    
    if (!groups[oId]) {
      groups[oId] = {
        order_id: sale.order_id,
        date: sale.date,
        channel: sale.channel,
        branch_or_platform: sale.branch_or_platform,
        recorded_by: sale.recorded_by,
        created_at: sale.created_at,
        total_items: 0,
        total_quantity: 0,
        total_amount: 0,
        items: []
      };
    }
    
    groups[oId].items.push(sale);
    groups[oId].total_items += 1;
    groups[oId].total_quantity += Number(sale.quantity);
    groups[oId].total_amount += Number(sale.total_amount);
  });

  return Object.values(groups).sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return (b.order_id || '').localeCompare(a.order_id || '');
  });
}
