# Change: เพิ่มระบบ Admin + สิทธิ์พนักงาน + สรุปออเดอร์

## Why
ระบบปัจจุบันไม่มีการจำกัดสิทธิ์การเข้าถึง ทุกคนเปิดเว็บแล้วทำอะไรก็ได้หมด ไม่มีการระบุว่าใครเป็นคนบันทึกข้อมูล และหน้าบันทึกยอดขายยังไม่สรุปเป็นรายออเดอร์/ใบเสร็จ

## What Changes

### Feature 1: ระบบ Admin + จำกัดสิทธิ์เมนู
- เพิ่มตาราง `users` ใน Turso — เก็บ Employee ID, PIN, role (admin/employee), สิทธิ์เมนู
- เพิ่ม API `/api/auth.js` — login ด้วย Employee ID + PIN, return session token
- เพิ่มหน้า Login — เมื่อยังไม่ login จะเข้าหน้าอื่นไม่ได้
- เพิ่มหน้า Admin — admin เท่านั้นที่เข้าได้ ใช้จัดการ:
  - เพิ่ม/แก้ไข/ลบ user (เชื่อมกับ Employee ที่มีอยู่)
  - ตั้ง PIN ให้พนักงาน
  - กำหนดสิทธิ์เมนูแต่ละคน (checkbox per menu)
- **Sidebar** ซ่อนเมนูที่ user ไม่มีสิทธิ์
- Admin มีสิทธิ์ทุกเมนูเสมอ

### Feature 2: ระบุชื่อผู้บันทึก
- ฟอร์มบันทึก (Sales, Stock, Income/Expense) มีฟิลด์ `ผู้บันทึก` ที่ lock เป็นชื่อ user ที่ login อยู่
- เพิ่ม column `recorded_by` ใน `sales_orders` และ `stock_in` (Turso)
- ตารางประวัติแสดงว่าใครเป็นคนบันทึก

### Feature 3: สรุปรายออเดอร์/ใบเสร็จ
- เพิ่ม column `order_id` ใน `sales_orders` (Turso)
- เมื่อบันทึก cart (batch) → สร้าง `order_id` เดียวกันให้ทุก item ใน batch
- หน้า SalesEntry แสดง **สรุปออเดอร์ล่าสุด** (แสดง 5-10 ออเดอร์ล่าสุด จัดกลุ่มตาม order_id)

## Impact
- **Affected code:**
  - `lib/turso.js` — เพิ่มตาราง users, เพิ่ม columns
  - `api/` — เพิ่ม `auth.js`, แก้ `sales.js`, `stock.js`
  - `src/pages/` — เพิ่ม `Login.tsx`, `AdminPanel.tsx`, แก้ `SalesEntry.tsx`
  - `src/components/layout/` — แก้ `sidebar.tsx`, `main-layout.tsx`
  - `src/types/` — เพิ่ม types ใหม่
  - `src/hooks/` — เพิ่ม `use-auth.ts`
  - `src/lib/` — เพิ่ม `auth-api.ts`
- **Affected specs:** employee-auth (new), sales-orders (modified)
- **Data migration:** เพิ่ม columns ใหม่ใน Turso (backward compatible — columns มี default value)
- **No breaking changes** — ข้อมูลเก่าไม่ได้ถูกลบหรือเปลี่ยน format
