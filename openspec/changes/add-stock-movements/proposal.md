# Change: ความเคลื่อนไหวสต๊อก + แก้ไขสินค้าในออเดอร์เดิม

## Why
ออเดอร์กรอกผิดแต่ส่งของไปแล้ว ต้องลบแล้วบันทึกใหม่ (ได้เลขออเดอร์ใหม่ ต้องตั้งสถานะจัดส่งใหม่) และการลบไม่ทิ้งร่องรอย — บอสอยากดูว่าสต๊อกเข้า/ออกเพราะอะไร ใครทำ เมื่อไหร่ และแก้ออเดอร์ให้ถูกได้ในที่เดียว

## What Changes
- ตารางใหม่ `stock_movements` (ประวัติเท่านั้น — สต๊อกคงเหลือยังคำนวณจาก `stock_in − sales_orders`)
  - type: `in` | `in_edit` | `in_delete` | `sale` | `sale_edit` | `sale_delete` · `qty_change` + เพิ่ม / − ลด
  - เขียนใน `db.batch` เดียวกับการแก้ข้อมูลจริง (`lib/stock-movements.js`)
  - ครั้งแรกดึงรับเข้า/ขายออกเดิมเข้าประวัติ (id `bf_in_*` / `bf_sale_*`, ธง `app_flags.stock_movements_backfilled`)
- `GET /api/stock?view=movements&from&to&q&type&limit` (ต้องล็อกอิน) — type กลุ่ม: in, sale, edit, delete
- `PUT /api/sales?order_id=` แก้สินค้าในออเดอร์ (Admin หรือผู้บันทึก): เปลี่ยน/เพิ่ม/ลบรายการ จำนวน ราคา ส่วนลด หมายเหตุ ค่าส่ง
  - คงเลขออเดอร์ วันที่ ช่องทาง สาขา ที่อยู่ COD สถานะจัดส่ง ผู้บันทึก created_at
  - เช็คสต๊อกเฉพาะล็อตที่ใช้เพิ่มขึ้น · ต้องเหลืออย่างน้อย 1 รายการ (ยกเลิกทั้งออเดอร์ = ลบออเดอร์)
- POST/DELETE ของ `/api/sales` และ POST/PUT/DELETE ของ `/api/stock` บันทึกประวัติด้วย
- หน้าใหม่ `/stock-movements` ("ความเคลื่อนไหวสต๊อก") + เมนู + สิทธิ์เมนู
- หน้าประวัติการขาย: ปุ่ม "แก้ไขสินค้า" เปิดหน้าต่างแก้ไข (ใช้ตารางสินค้าร่วมกับหน้าบันทึกยอดขาย `src/components/sales/order-items-editor.tsx`)

## Impact
- Affected specs: `stock-movements` (ใหม่)
- Affected code: `lib/turso.js`, `lib/stock-movements.js`, `api/sales.js`, `api/stock.js`, `src/lib/{sales,stock}-api.ts`, `src/components/sales/*`, `src/pages/{SalesEntry,OrderHistory,StockMovements}.tsx`, เมนู 3 จุด
- ประวัติการแก้ไข/ลบก่อน 19 ก.ย. 2569 ไม่มี (ไม่เคยเก็บ)
- แก้ออเดอร์ = ลบแถวเดิมแล้วสร้างใหม่ (id แถวเปลี่ยน, order_id คงเดิม)
