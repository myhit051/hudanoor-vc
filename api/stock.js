import { getTursoClient, initSchema } from '../lib/turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    // GET /api/stock — ดึงรายการสต๊อก
    if (req.method === 'GET') {
      const { date, sku, available, view, limit = 500, offset = 0 } = req.query;

      // view=inventory — คืน aggregated สต๊อกคงเหลือ
      if (view === 'inventory') {
        const result = await db.execute({
          sql: `
            SELECT
              s.sku,
              s.product_name,
              s.color,
              s.size,
              COALESCE(SUM(s.quantity), 0) AS total_in,
              COALESCE(SUM(so.qty_sold), 0) AS total_sold,
              COALESCE(SUM(s.quantity), 0) - COALESCE(SUM(so.qty_sold), 0) AS remaining,
              COALESCE(AVG(s.cost_price), 0) AS avg_cost_price,
              COALESCE(AVG(s.sell_price), 0) AS avg_sell_price,
              (COALESCE(SUM(s.quantity), 0) - COALESCE(SUM(so.qty_sold), 0)) * COALESCE(AVG(s.cost_price), 0) AS stock_value
            FROM stock_in s
            LEFT JOIN (
              SELECT sku, color, size, SUM(quantity) AS qty_sold
              FROM sales_orders
              GROUP BY sku, color, size
            ) so ON s.sku = so.sku AND s.color = so.color AND s.size = so.size
            GROUP BY s.sku, s.product_name, s.color, s.size
            ORDER BY s.sku, s.color, s.size
          `,
          args: []
        });
        return res.status(200).json({ data: result.rows });
      }

      // available=true — คืนเฉพาะรายการที่ยังมีสต๊อก > 0
      if (available === 'true') {
        const result = await db.execute({
          sql: `
            SELECT
              s.*,
              s.quantity - COALESCE(SUM(so.quantity), 0) AS available_quantity
            FROM stock_in s
            LEFT JOIN sales_orders so
              ON s.id = so.stock_in_id
            GROUP BY s.id
            HAVING available_quantity > 0
            ORDER BY s.sku, s.color, s.size
            LIMIT ?
          `,
          args: [Number(limit)]
        });
        return res.status(200).json({ data: result.rows });
      }

      // default — ดึงรายการสต๊อกทั้งหมด
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

    // PUT /api/stock — แก้ไขสต๊อก
    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { quantity, cost_price, sell_price, note, product_name, date } = req.body;
      const now = new Date().toISOString();

      // ตรวจสอบว่าปริมาณไม่ต่ำกว่าที่ขายไปแล้ว
      if (quantity !== undefined) {
        const soldResult = await db.execute({
          sql: `SELECT COALESCE(SUM(so.quantity), 0) AS qty_sold FROM sales_orders so WHERE so.stock_in_id = ?`,
          args: [id]
        });
        const qtySold = Number(soldResult.rows[0]?.qty_sold || 0);
        if (Number(quantity) < qtySold) {
          return res.status(400).json({ error: `ไม่สามารถลดจำนวนต่ำกว่าที่ขายไปแล้ว (${qtySold} ชิ้น)` });
        }
      }

      const fields = [];
      const args = [];
      if (quantity !== undefined) { fields.push('quantity = ?'); args.push(Number(quantity)); }
      if (cost_price !== undefined) { fields.push('cost_price = ?'); args.push(Number(cost_price)); }
      if (sell_price !== undefined) { fields.push('sell_price = ?'); args.push(Number(sell_price)); }
      if (note !== undefined) { fields.push('note = ?'); args.push(note); }
      if (product_name !== undefined) { fields.push('product_name = ?'); args.push(product_name); }
      if (date !== undefined) { fields.push('date = ?'); args.push(date); }

      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

      fields.push('updated_at = ?');
      args.push(now, id);

      await db.execute({ sql: `UPDATE stock_in SET ${fields.join(', ')} WHERE id = ?`, args });
      return res.status(200).json({ success: true });
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
