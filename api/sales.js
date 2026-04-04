import { getTursoClient, initSalesSchema, initStockSchema } from '../lib/turso.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSalesSchema();
    await initStockSchema();
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

    // POST /api/sales — บันทึกยอดขาย + หักสต๊อก (batch)
    if (req.method === 'POST') {
      const {
        date, channel, branch_or_platform,
        sku, product_name, color, size,
        quantity, unit_price,
        discount_type, discount_value,
        note, stock_in_id
      } = req.body;

      if (!date || !sku || !product_name || !stock_in_id) {
        return res.status(400).json({ error: 'กรุณากรอกข้อมูลให้ครบ (date, sku, product_name, stock_in_id)' });
      }

      const qty = Number(quantity) || 1;
      const price = Number(unit_price) || 0;
      const discVal = Number(discount_value) || 0;
      const discType = discount_type === 'percent' ? 'percent' : 'amount';

      // คำนวณส่วนลด
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

      // ตรวจสอบสต๊อกคงเหลือ
      const stockCheck = await db.execute({
        sql: `
          SELECT s.quantity - COALESCE(SUM(so.quantity), 0) AS available
          FROM stock_in s
          LEFT JOIN sales_orders so ON s.id = so.stock_in_id
          WHERE s.id = ?
          GROUP BY s.id
        `,
        args: [stock_in_id]
      });

      const available = stockCheck.rows[0]?.available ?? 0;
      if (Number(available) < qty) {
        return res.status(400).json({ error: `สต๊อกไม่เพียงพอ (คงเหลือ ${available} ชิ้น)` });
      }

      const id = `sale_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();

      // batch: insert sales_order + deduct stock_in
      await db.batch([
        {
          sql: `INSERT INTO sales_orders
                  (id, date, channel, branch_or_platform, sku, product_name, color, size,
                   quantity, unit_price, discount_type, discount_value, discount_amount,
                   final_unit_price, total_amount, note, stock_in_id, created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            id, date, channel || '', branch_or_platform || '',
            sku, product_name, color || '', size || '',
            qty, price, discType, discVal, discountAmount,
            finalUnitPrice, totalAmount, note || '', stock_in_id, now
          ]
        },
        {
          sql: `UPDATE stock_in SET quantity = quantity - ?, updated_at = ? WHERE id = ?`,
          args: [qty, now, stock_in_id]
        }
      ]);

      return res.status(201).json({ success: true, id });
    }

    // DELETE /api/sales?id=xxx — ลบยอดขาย + คืนสต๊อก (batch)
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      // ดึงข้อมูล sale ก่อนลบ เพื่อรู้ว่าต้องคืนสต๊อกเท่าไร
      const saleResult = await db.execute({
        sql: 'SELECT quantity, stock_in_id FROM sales_orders WHERE id = ?',
        args: [id]
      });

      if (saleResult.rows.length === 0) {
        return res.status(404).json({ error: 'ไม่พบรายการ' });
      }

      const { quantity: qty, stock_in_id } = saleResult.rows[0];
      const now = new Date().toISOString();

      await db.batch([
        {
          sql: 'DELETE FROM sales_orders WHERE id = ?',
          args: [id]
        },
        ...(stock_in_id ? [{
          sql: 'UPDATE stock_in SET quantity = quantity + ?, updated_at = ? WHERE id = ?',
          args: [qty, now, stock_in_id]
        }] : [])
      ]);

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Sales API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
