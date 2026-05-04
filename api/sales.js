import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate } from '../lib/auth-middleware.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    // GET /api/sales — ดึงรายการขาย
    if (req.method === 'GET') {
      const { date, sku, channel, limit = 200, offset = 0 } = req.query;

      let query = 'SELECT * FROM sales_orders WHERE 1=1';
      const args = [];

      if (date) {
        query += ' AND date = ?';
        args.push(date);
      }
      if (sku) {
        query += ' AND sku LIKE ?';
        args.push(`%${sku}%`);
      }
      if (channel) {
        query += ' AND channel = ?';
        args.push(channel);
      }

      query += ' ORDER BY date DESC, created_at DESC LIMIT ? OFFSET ?';
      args.push(Number(limit), Number(offset));

      const result = await db.execute({ sql: query, args });
      return res.status(200).json({ data: result.rows });
    }

    // POST /api/sales — บันทึกยอดขาย + หักสต๊อก (รองรับทั้ง single object และ array)
    if (req.method === 'POST') {
      const authUser = authenticate(req);
      const recordedBy = authUser ? authUser.name : '';
      const items = Array.isArray(req.body) ? req.body : [req.body];
      const now = new Date().toISOString();

      // Generate order_id
      const dateString = now.split('T')[0].replace(/-/g, '');
      const prefix = `ORD-${dateString}-`;
      const seqResult = await db.execute({
        sql: `SELECT COUNT(DISTINCT order_id) as count FROM sales_orders WHERE order_id LIKE ?`,
        args: [`${prefix}%`]
      });
      const seq = String((seqResult.rows[0]?.count || 0) + 1).padStart(3, '0');
      const orderId = `${prefix}${seq}`;

      // ตรวจสอบข้อมูลและคำนวณ
      const processed = [];
      for (const item of items) {
        const { date, channel, branch_or_platform, sku, product_name, color, size,
                quantity, unit_price, discount_type, discount_value, note, stock_in_id } = item;

        if (!date || !sku || !product_name || !stock_in_id) {
          return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ (date, sku, product_name, stock_in_id)' });
        }

        const qty = Number(quantity) || 1;
        const price = Number(unit_price) || 0;
        const discVal = Number(discount_value) || 0;
        const discType = discount_type === 'percent' ? 'percent' : 'amount';

        let discountAmount = 0;
        let finalUnitPrice = price;
        if (discType === 'percent') {
          discountAmount = price * (discVal / 100);
          finalUnitPrice = price - discountAmount;
        } else {
          discountAmount = discVal;
          finalUnitPrice = price - discVal;
        }
        if (finalUnitPrice < 0) finalUnitPrice = 0;
        const totalAmount = finalUnitPrice * qty;

        processed.push({ date, channel, branch_or_platform, sku, product_name, color, size,
          qty, price, discType, discVal, discountAmount, finalUnitPrice, totalAmount,
          note, stock_in_id });
      }

      // ตรวจสอบสต๊อกทุกรายการ (รวม qty ของ stock_in_id เดียวกัน)
      const stockNeeds = {};
      for (const p of processed) {
        stockNeeds[p.stock_in_id] = (stockNeeds[p.stock_in_id] || 0) + p.qty;
      }
      for (const [sid, needed] of Object.entries(stockNeeds)) {
        const stockCheck = await db.execute({
          sql: `SELECT s.quantity - COALESCE(SUM(so.quantity), 0) AS available
                FROM stock_in s
                LEFT JOIN sales_orders so ON s.id = so.stock_in_id
                WHERE s.id = ?
                GROUP BY s.id`,
          args: [sid]
        });
        const available = stockCheck.rows[0]?.available ?? 0;
        if (Number(available) < needed) {
          return res.status(400).json({ error: `สต๊อกไม่เพียงพอสำหรับ stock_in_id ${sid} (คงเหลือ ${available} ต้องการ ${needed} ชิ้น)` });
        }
      }

      // batch: insert ทุก sale (available stock คำนวณจาก sales_orders อัตโนมัติ ไม่ต้องหัก stock_in.quantity)
      const batchOps = [];
      for (const p of processed) {
        const id = `sale_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        batchOps.push({
          sql: `INSERT INTO sales_orders
                  (id, date, channel, branch_or_platform, sku, product_name, color, size,
                   quantity, unit_price, discount_type, discount_value, discount_amount,
                   final_unit_price, total_amount, note, stock_in_id, order_id, recorded_by, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            id, p.date, p.channel || '', p.branch_or_platform || '',
            p.sku, p.product_name, p.color || '', p.size || '',
            p.qty, p.price, p.discType, p.discVal, p.discountAmount,
            p.finalUnitPrice, p.totalAmount, p.note || '', p.stock_in_id, orderId, recordedBy, now
          ]
        });
      }
      await db.batch(batchOps);

      return res.status(201).json({ success: true, count: processed.length });
    }

    // DELETE /api/sales?id=xxx หรือ ?order_id=xxx — ลบยอดขาย (available stock คำนวณจาก sales_orders อัตโนมัติ)
    if (req.method === 'DELETE') {
      const authUser = authenticate(req);
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });

      const { id, order_id } = req.query;
      if (!id && !order_id) return res.status(400).json({ error: 'Missing id or order_id' });

      let sql = '';
      let args = [];
      if (order_id) {
        sql = 'SELECT id, recorded_by FROM sales_orders WHERE order_id = ? LIMIT 1';
        args = [order_id];
      } else {
        sql = 'SELECT id, recorded_by FROM sales_orders WHERE id = ?';
        args = [id];
      }

      const saleResult = await db.execute({ sql, args });

      if (saleResult.rows.length === 0) {
        return res.status(404).json({ error: 'ไม่พบรายการ' });
      }

      // Check permission: must be admin or the creator
      const creator = saleResult.rows[0].recorded_by;
      if (authUser.role !== 'admin' && authUser.name !== creator) {
        return res.status(403).json({ error: 'ไม่มีสิทธิ์ลบรายการนี้ (ลบได้เฉพาะ Admin หรือผู้บันทึก)' });
      }

      if (order_id) {
        await db.execute({ sql: 'DELETE FROM sales_orders WHERE order_id = ?', args: [order_id] });
      } else {
        await db.execute({ sql: 'DELETE FROM sales_orders WHERE id = ?', args: [id] });
      }

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
