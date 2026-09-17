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

## 4. แก้ตามรีวิว
- [x] 4.1 `order_counters` + จองเลขออเดอร์แบบ atomic (ทดสอบ: ลบแล้วบันทึกพร้อมกัน 3 ออเดอร์ ไม่ซ้ำ)
- [x] 4.2 `GET /api/sales` ต้องล็อกอิน
- [x] 4.3 ค่าส่งระดับออเดอร์ (หน้าเว็บ + เซิร์ฟเวอร์ใช้รายการแรก)
- [x] 4.4 กำไรไม่นับค่าส่ง
- [x] 4.5 ปรับหน้าจัดส่ง (สวิตช์ที่อยู่, คงรายการที่เลือก, ตัดที่อยู่ร้าน)
