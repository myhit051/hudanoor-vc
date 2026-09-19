// บันทึกความเคลื่อนไหวสต๊อก (ตาราง stock_movements) — ไว้ดูย้อนหลังว่าสต๊อกเข้า/ออกเพราะอะไร ใครทำ เมื่อไหร่
// สต๊อกคงเหลือยังคำนวณจาก stock_in − sales_orders เหมือนเดิม ตารางนี้เป็นแค่ประวัติ
// ให้ใส่ statement จาก movementStmt() ใน db.batch เดียวกับการแก้ข้อมูลจริง ประวัติจะได้ไม่คลาดกับข้อมูล
//
// type: in (รับเข้า) | in_edit (แก้จำนวนล็อต) | in_delete (ลบล็อต)
//       sale (ขายออก) | sale_edit (แก้ไขสินค้าในออเดอร์) | sale_delete (ลบออเดอร์/รายการขาย)
// qty_change: + = สต๊อกเพิ่ม, − = สต๊อกลด

export const MOVEMENT_TYPES = ['in', 'in_edit', 'in_delete', 'sale', 'sale_edit', 'sale_delete'];

export function movementStmt({
  type, sku, product_name, color = '', size = '', qty_change,
  stock_in_id = '', order_id = '', detail = '', recorded_by = '', created_at
}) {
  const id = `mv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return {
    sql: `INSERT INTO stock_movements
            (id, created_at, type, sku, product_name, color, size, qty_change, stock_in_id, order_id, detail, recorded_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, created_at || new Date().toISOString(), type,
      sku || '', product_name || '', color || '', size || '',
      Math.trunc(Number(qty_change) || 0),
      stock_in_id || '', order_id || '', detail || '', recorded_by || ''
    ]
  };
}
