import { getTursoClient, initStockSchema } from '../lib/turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initStockSchema();
    const db = getTursoClient();

    // GET /api/stock — ดึงรายการสต๊อกทั้งหมด
    if (req.method === 'GET') {
      const { date, sku, limit = 100, offset = 0 } = req.query;

      let query = 'SELECT * FROM stock_in WHERE 1=1';
      const args = [];

      if (date) {
        query += ' AND date = ?';
        args.push(date);
      }
      if (sku) {
        query += ' AND sku LIKE ?';
        args.push(`%${sku}%`);
      }

      query += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
      args.push(Number(limit), Number(offset));

      const result = await db.execute({ sql: query, args });
      return res.status(200).json({ data: result.rows });
    }

    // POST /api/stock — บันทึกสต๊อกใหม่
    if (req.method === 'POST') {
      const { date, sku, product_name, color, size, quantity, cost_price, sell_price, note } = req.body;

      if (!date || !sku || !product_name) {
        return res.status(400).json({ error: 'กรุณากรอก วันที่, SKU, และชื่อสินค้า' });
      }

      const id = `stock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();

      await db.execute({
        sql: `INSERT INTO stock_in (id, date, sku, product_name, color, size, quantity, cost_price, sell_price, note, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id, date, sku, product_name,
          color || '', size || '',
          Number(quantity) || 1,
          Number(cost_price) || 0,
          Number(sell_price) || 0,
          note || '', now, now
        ]
      });

      return res.status(201).json({ success: true, id });
    }

    // DELETE /api/stock?id=xxx
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      await db.execute({ sql: 'DELETE FROM stock_in WHERE id = ?', args: [id] });
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Stock API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
