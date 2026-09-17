## 1. Backend
- [x] 1.1 migration `shipping_status` ใน `lib/turso.js`
- [x] 1.2 `PATCH /api/sales` อัปเดตสถานะจัดส่งหลายออเดอร์

## 2. Frontend
- [x] 2.1 `ShippingStatus`, `updateShippingStatus()` และ `shipping_status` ใน `groupSalesByOrder`
- [x] 2.2 หน้า `src/pages/Shipping.tsx` (ตัวกรอง, แท็บสถานะ, เลือกหลายรายการ, PDF ใบปะหน้า)
- [x] 2.3 route `/shipping`, เมนู sidebar, `MENU_OPTIONS`

## 3. ตรวจสอบ
- [x] 3.1 `npm run build` ผ่าน
- [x] 3.2 ทดสอบในเบราว์เซอร์ด้วยข้อมูลจำลอง: PDF ทั้งสองขนาด, ข้ามออเดอร์ไม่มีที่อยู่, เปลี่ยนสถานะแบบกลุ่ม, หน้าจอมือถือ
