import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate } from '../lib/auth-middleware.js';

/**
 * One-time migration: undo incorrect stock_in.quantity deductions.
 *
 * Background:
 *   Previously, every sale INSERT also did  UPDATE stock_in SET quantity = quantity - N.
 *   But available stock was already computed as:
 *     stock_in.quantity - SUM(sales_orders.quantity)
 *   This double-counted each sale, making available stock drop by 2x.
 *
 * Fix:
 *   For every stock_in row that has sales, add back the total sold quantity
 *   so that stock_in.quantity returns to its original "total received" value.
 *
 * GET  → dry run (preview changes)
 * POST → apply changes
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require auth for safety
    const authUser = authenticate(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await initSchema();
    const db = getTursoClient();

    // Find all stock_in items that have been sold (and thus incorrectly decremented)
    const result = await db.execute({
      sql: `
        SELECT
          s.id,
          s.sku,
          s.product_name,
          s.color,
          s.size,
          s.quantity AS current_quantity,
          COALESCE(SUM(so.quantity), 0) AS total_sold,
          s.quantity + COALESCE(SUM(so.quantity), 0) AS corrected_quantity
        FROM stock_in s
        INNER JOIN sales_orders so ON s.id = so.stock_in_id
        GROUP BY s.id
        HAVING total_sold > 0
        ORDER BY s.sku, s.color, s.size
      `,
      args: []
    });

    const rows = result.rows;

    if (rows.length === 0) {
      return res.status(200).json({
        message: 'ไม่พบข้อมูลที่ต้องแก้ไข — สต๊อกถูกต้องแล้ว',
        affected: 0
      });
    }

    // GET = dry run preview
    if (req.method === 'GET') {
      return res.status(200).json({
        mode: 'dry-run (ดูตัวอย่างก่อน — ใช้ POST เพื่อแก้จริง)',
        affected: rows.length,
        changes: rows.map(r => ({
          id: r.id,
          sku: r.sku,
          product_name: r.product_name,
          color: r.color,
          size: r.size,
          current_quantity: r.current_quantity,
          total_sold: r.total_sold,
          corrected_quantity: r.corrected_quantity
        }))
      });
    }

    // POST = apply fix
    const now = new Date().toISOString();
    const batchOps = rows.map(r => ({
      sql: `UPDATE stock_in SET quantity = ?, updated_at = ? WHERE id = ?`,
      args: [r.corrected_quantity, now, r.id]
    }));

    await db.batch(batchOps);

    return res.status(200).json({
      success: true,
      message: `แก้ไขสต๊อก ${rows.length} รายการสำเร็จ`,
      affected: rows.length,
      changes: rows.map(r => ({
        id: r.id,
        sku: r.sku,
        product_name: r.product_name,
        before: r.current_quantity,
        added_back: r.total_sold,
        after: r.corrected_quantity
      }))
    });

  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
