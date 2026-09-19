import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate } from '../lib/auth-middleware.js';
import { movementStmt, MOVEMENT_TYPES } from '../lib/stock-movements.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    // GET /api/stock — ดึงรายการสต๊อก
    if (req.method === 'GET') {
      const { date, sku, available, view, limit = 500, offset = 0 } = req.query;

      // view=movements — ประวัติความเคลื่อนไหวสต๊อก เรียงล่าสุดก่อน (มีชื่อคนบันทึก/เลขออเดอร์ ต้องล็อกอิน)
      // from/to = เวลา ISO (หน้าเว็บแปลงวันที่ไทยให้แล้ว) · q = ค้นรหัส/ชื่อสินค้า/เลขออเดอร์ · type = in|sale|edit|delete
      if (view === 'movements') {
        if (!authenticate(req)) return res.status(401).json({ error: 'Unauthorized' });
        const { from, to, q, type } = req.query;
        let sql = 'SELECT * FROM stock_movements WHERE 1=1';
        const args = [];
        if (from) { sql += ' AND created_at >= ?'; args.push(String(from)); }
        if (to) { sql += ' AND created_at < ?'; args.push(String(to)); }
        if (q) {
          sql += ' AND (sku LIKE ? OR product_name LIKE ? OR order_id LIKE ?)';
          const like = `%${String(q).trim()}%`;
          args.push(like, like, like);
        }
        const typeGroups = { in: ['in'], sale: ['sale'], edit: ['in_edit', 'sale_edit'], delete: ['in_delete', 'sale_delete'] };
        const types = typeGroups[type] || (MOVEMENT_TYPES.includes(type) ? [type] : null);
        if (types) { sql += ` AND type IN (${types.map(() => '?').join(',')})`; args.push(...types); }
        sql += ' ORDER BY created_at DESC, id DESC LIMIT ?';
        args.push(Math.min(Number(limit) || 500, 2000));
        const result = await db.execute({ sql, args });
        return res.status(200).json({ data: result.rows });
      }

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
              (COALESCE(SUM(s.quantity), 0) - COALESCE(SUM(so.qty_sold), 0)) * COALESCE(AVG(s.cost_price), 0) AS stock_value,
              MAX(CASE WHEN s.image_url != '' THEN s.image_url END) AS image_url
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

      // view=lots — คืนสต๊อกรายล็อตนำเข้า (1 แถว stock_in = 1 ล็อต) พร้อมยอดขาย/คงเหลือของล็อตนั้น
      if (view === 'lots') {
        const lotsResult = await db.execute({
          sql: `
            SELECT
              s.id, s.date, s.sku, s.product_name,
              COALESCE(s.product_category, '') AS product_category,
              s.color, s.size, s.quantity, s.cost_price, s.sell_price,
              COALESCE(s.note, '') AS note,
              COALESCE(s.image_url, '') AS image_url,
              COALESCE(s.recorded_by, '') AS recorded_by,
              s.created_at,
              COALESCE(linked.qty_sold, 0) AS linked_sold
            FROM stock_in s
            LEFT JOIN (
              SELECT stock_in_id, SUM(quantity) AS qty_sold
              FROM sales_orders
              WHERE stock_in_id IS NOT NULL AND stock_in_id != ''
              GROUP BY stock_in_id
            ) linked ON linked.stock_in_id = s.id
            ORDER BY s.date ASC, s.created_at ASC
          `,
          args: []
        });

        // ยอดขายที่ผูกล็อตไม่ได้ — ไม่ได้ระบุล็อต หรือระบุล็อตที่ถูกลบไปแล้ว
        // ต้องนับด้วย ไม่งั้นคงเหลือรายล็อตจะมากกว่าความจริงและไม่ตรงกับ view=inventory
        const unlinkedResult = await db.execute({
          sql: `
            SELECT so.sku, so.color, so.size, SUM(so.quantity) AS qty_sold
            FROM sales_orders so
            WHERE so.stock_in_id IS NULL
               OR so.stock_in_id = ''
               OR NOT EXISTS (SELECT 1 FROM stock_in s WHERE s.id = so.stock_in_id)
            GROUP BY so.sku, so.color, so.size
          `,
          args: []
        });

        const groupKey = (r) => `${r.sku}|${r.color}|${r.size}`;
        const pendingSold = new Map(
          unlinkedResult.rows.map((r) => [groupKey(r), Number(r.qty_sold) || 0])
        );

        // รอบแรก — หักยอดที่ผูกล็อตไว้ตรง ๆ ส่วนที่เกินจำนวนของล็อตนั้นโยนเข้ากองรอเกลี่ย
        const lots = lotsResult.rows.map((r) => {
          const quantity = Number(r.quantity) || 0;
          const linkedSold = Number(r.linked_sold) || 0;
          const key = groupKey(r);

          if (linkedSold > quantity) {
            pendingSold.set(key, (pendingSold.get(key) || 0) + (linkedSold - quantity));
          }

          return {
            id: r.id,
            date: r.date,
            sku: r.sku,
            product_name: r.product_name,
            product_category: r.product_category,
            color: r.color,
            size: r.size,
            quantity,
            cost_price: Number(r.cost_price) || 0,
            sell_price: Number(r.sell_price) || 0,
            note: r.note,
            image_url: r.image_url,
            recorded_by: r.recorded_by,
            created_at: r.created_at,
            qty_sold: Math.min(linkedSold, quantity),
            remaining: quantity - Math.min(linkedSold, quantity)
          };
        });

        // รอบสอง — เกลี่ยยอดที่เหลือแบบเข้าก่อนออกก่อน (FIFO) ภายใน SKU/สี/ไซส์เดียวกัน
        // (lotsResult เรียงตามวันที่รับเข้าจากเก่าไปใหม่อยู่แล้ว)
        for (const lot of lots) {
          const key = groupKey(lot);
          const pending = pendingSold.get(key) || 0;
          if (pending <= 0) continue;

          const take = Math.min(pending, lot.remaining);
          if (take > 0) {
            lot.qty_sold += take;
            lot.remaining -= take;
            pendingSold.set(key, pending - take);
          }
        }

        return res.status(200).json({ data: lots });
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
    // เพิ่ม/แก้/ลบล็อตสต๊อกต้องล็อกอิน (กระทบสต๊อกและต้นทุน + ต้องรู้ว่าใครทำ)
    if (req.method === 'POST') {
      const authUser = authenticate(req);
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const recordedBy = authUser.name;
      const { date, sku, product_name, product_category, color, size, quantity, cost_price, sell_price, note, image_url } = req.body;

      if (!date || !sku || !product_name) {
        return res.status(400).json({ error: 'กรุณากรอก วันที่, SKU, และชื่อสินค้า' });
      }

      const id = `stock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();

      await db.batch([
        {
          sql: `INSERT INTO stock_in (id, date, sku, product_name, product_category, color, size, quantity, cost_price, sell_price, note, image_url, recorded_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            id, date, sku, product_name, product_category || '',
            color || '', size || '',
            Number(quantity) || 1,
            Number(cost_price) || 0,
            Number(sell_price) || 0,
            note || '', image_url || '', recordedBy, now, now
          ]
        },
        movementStmt({
          type: 'in', sku, product_name, color, size, qty_change: Number(quantity) || 1,
          stock_in_id: id, detail: 'รับเข้า', recorded_by: recordedBy, created_at: now
        })
      ], 'write');

      return res.status(201).json({ success: true, id });
    }

    // PUT /api/stock — แก้ไขสต๊อก
    if (req.method === 'PUT') {
      const authUser = authenticate(req);
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const { quantity, cost_price, sell_price, note, product_name, product_category, date, image_url } = req.body;
      const now = new Date().toISOString();

      const oldResult = await db.execute({ sql: 'SELECT * FROM stock_in WHERE id = ?', args: [id] });
      const oldLot = oldResult.rows[0];
      if (!oldLot) return res.status(404).json({ error: 'ไม่พบล็อตสินค้านี้' });

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
      if (product_category !== undefined) { fields.push('product_category = ?'); args.push(product_category); }
      if (date !== undefined) { fields.push('date = ?'); args.push(date); }
      if (image_url !== undefined) { fields.push('image_url = ?'); args.push(image_url); }

      if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

      fields.push('updated_at = ?');
      args.push(now, id);

      const ops = [{ sql: `UPDATE stock_in SET ${fields.join(', ')} WHERE id = ?`, args }];
      const qtyDiff = quantity !== undefined ? Number(quantity) - Number(oldLot.quantity) : 0;
      if (qtyDiff !== 0) {
        ops.push(movementStmt({
          type: 'in_edit', sku: oldLot.sku, product_name: product_name ?? oldLot.product_name,
          color: oldLot.color, size: oldLot.size, qty_change: qtyDiff, stock_in_id: id,
          detail: `แก้จำนวนรับเข้า ${Number(oldLot.quantity)} → ${Number(quantity)}`,
          recorded_by: authUser.name, created_at: now
        }));
      }
      await db.batch(ops, 'write');
      return res.status(200).json({ success: true });
    }

    // DELETE /api/stock?id=xxx
    if (req.method === 'DELETE') {
      const authUser = authenticate(req);
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing id' });

      const lotResult = await db.execute({ sql: 'SELECT * FROM stock_in WHERE id = ?', args: [id] });
      const lot = lotResult.rows[0];
      const ops = [{ sql: 'DELETE FROM stock_in WHERE id = ?', args: [id] }];
      if (lot) {
        ops.push(movementStmt({
          type: 'in_delete', sku: lot.sku, product_name: lot.product_name, color: lot.color, size: lot.size,
          qty_change: -Number(lot.quantity || 0), stock_in_id: id,
          detail: `ลบล็อตรับเข้า (วันที่รับ ${lot.date})`, recorded_by: authUser.name
        }));
      }
      await db.batch(ops, 'write');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Stock API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
