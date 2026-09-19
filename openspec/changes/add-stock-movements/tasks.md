## 1. Backend
- [x] 1.1 ตาราง `stock_movements` + backfill ครั้งเดียว (`lib/turso.js`)
- [x] 1.2 `movementStmt()` + บันทึกใน POST/DELETE sales, POST/PUT/DELETE stock
- [x] 1.3 `PUT /api/sales?order_id=` แก้สินค้าในออเดอร์
- [x] 1.4 `GET /api/stock?view=movements`

## 2. Frontend
- [x] 2.1 แยก `OrderItemsEditor` ใช้ร่วม
- [x] 2.2 `EditOrderItemsDialog` + ปุ่มในหน้าประวัติการขาย
- [x] 2.3 หน้า `StockMovements` + route/เมนู/สิทธิ์เมนู

## 3. ตรวจสอบ
- [x] 3.1 API กับ SQLite: backfill, ขาย/แก้/ลบ, สต๊อกไม่พอ, สิทธิ์ 401/403, ค่าส่ง/COD/สถานะคงเดิม, ตัวกรอง
- [x] 3.2 หน้าเว็บ (Playwright + handler จริง + SQLite): แก้ออเดอร์ผ่านหน้าต่าง, หน้าประวัติสต๊อก คอม/มือถือ, หน้าบันทึกยอดขายเดิมยังผ่าน
