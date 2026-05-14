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

export interface StockItem {
  id: string;
  date: string;
  sku: string;
  product_name: string;
  product_category: string;
  color: string;
  size: string;
  quantity: number;
  cost_price: number;
  sell_price: number;
  note: string;
  image_url: string;
  recorded_by: string;
  created_at: string;
  updated_at: string;
}

export type NewStockItem = Omit<StockItem, 'id' | 'created_at' | 'updated_at' | 'recorded_by'>;

export async function getStockItems(params?: { date?: string; sku?: string }): Promise<StockItem[]> {
  const query = new URLSearchParams();
  if (params?.date) query.set('date', params.date);
  if (params?.sku) query.set('sku', params.sku);

  const res = await fetch(`${API_BASE}/stock?${query}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch stock');
  const data = await res.json();
  return data.data as StockItem[];
}

export async function addStockItem(item: NewStockItem): Promise<void> {
  const res = await fetch(`${API_BASE}/stock`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(item)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to add stock');
  }
}

export async function deleteStockItem(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/stock?id=${id}`, { 
    method: 'DELETE',
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to delete stock');
}

export type UpdateStockItem = Partial<Pick<StockItem, 'quantity' | 'cost_price' | 'sell_price' | 'note' | 'product_name' | 'product_category' | 'date' | 'image_url'>>;

export async function updateStockItem(id: string, data: UpdateStockItem): Promise<void> {
  const res = await fetch(`${API_BASE}/stock?id=${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update stock');
  }
}

export interface AvailableStockItem extends StockItem {
  available_quantity: number;
}

export interface StockInventoryItem {
  sku: string;
  product_name: string;
  color: string;
  size: string;
  total_in: number;
  total_sold: number;
  remaining: number;
  avg_cost_price: number;
  avg_sell_price: number;
  stock_value: number;
  image_url?: string;
}

export async function getAvailableStock(): Promise<AvailableStockItem[]> {
  const res = await fetch(`${API_BASE}/stock?available=true`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch available stock');
  const data = await res.json();
  return data.data as AvailableStockItem[];
}

export async function getStockInventory(): Promise<StockInventoryItem[]> {
  const res = await fetch(`${API_BASE}/stock?view=inventory`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch stock inventory');
  const data = await res.json();
  return data.data as StockInventoryItem[];
}

// บีบอัดรูปฝั่ง browser ด้วย Canvas ก่อนอัพโหลด — ลด payload ทั้งฝั่งเครือข่ายและพื้นที่เก็บ
async function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<File> {
  // ข้ามไฟล์ที่เล็กอยู่แล้ว, ที่ไม่ใช่รูป, หรือฟอร์แมตที่ห้ามแปลง (gif=เสียอนิเมชั่น, svg=vector)
  if (file.size < 150 * 1024) return file;
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function uploadProductImage(file: File, sku: string): Promise<string> {
  const compressed = await compressImage(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const res = await fetch(`${API_BASE}/upload`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ base64, filename: compressed.name, mimeType: compressed.type, sku })
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Upload failed');
        }
        const data = await res.json();
        resolve(data.url);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(compressed);
  });
}
