## 1. Database Schema (Turso)
- [ ] 1.1 เพิ่ม `users` table ใน `lib/turso.js` — `initSchema()`
  - columns: `id`, `employee_id`, `name`, `pin_hash`, `role` (admin/employee), `allowed_menus` (JSON), `is_active`, `created_at`, `updated_at`
  - index บน `employee_id` (unique)
- [ ] 1.2 เพิ่ม column `recorded_by` ใน `sales_orders` table (DEFAULT '')
- [ ] 1.3 เพิ่ม column `recorded_by` ใน `stock_in` table (DEFAULT '')
- [ ] 1.4 เพิ่ม column `order_id` ใน `sales_orders` table (DEFAULT '')
- [ ] 1.5 เพิ่ม index `idx_sales_orders_order_id` บน `order_id`

## 2. Auth API (Backend)
- [ ] 2.1 สร้าง `api/auth.js` — POST login (employee_id + pin → JWT), GET verify token
- [ ] 2.2 สร้าง helper `lib/jwt.js` — sign/verify JWT ด้วย env `JWT_SECRET`
- [ ] 2.3 สร้าง helper `lib/auth-middleware.js` — verify JWT จาก `Authorization: Bearer` header

## 3. Users API (Backend)
- [ ] 3.1 สร้าง `api/users.js` — CRUD สำหรับ admin จัดการ users
  - GET: list all users (admin only)
  - POST: create user (employee_id, name, pin, role, allowed_menus)
  - PUT: update user (เปลี่ยน pin, role, allowed_menus)
  - DELETE: soft delete (set is_active = false)
- [ ] 3.2 ทุก request ต้องมี JWT + role=admin (ยกเว้น auth login)

## 4. แก้ไข Sales API
- [ ] 4.1 แก้ `api/sales.js` POST — รับ `recorded_by` จาก JWT payload
- [ ] 4.2 แก้ `api/sales.js` POST — สร้าง `order_id` (format: `ORD-YYYYMMDD-NNN`) ให้ทุก item ใน batch เดียวกัน
- [ ] 4.3 แก้ `api/sales.js` GET — return `recorded_by` และ `order_id`

## 5. แก้ไข Stock API
- [ ] 5.1 แก้ `api/stock.js` POST — รับ `recorded_by` จาก JWT payload

## 6. Frontend: Auth System
- [ ] 6.1 สร้าง `src/types/auth.ts` — AuthUser, LoginCredentials types
- [ ] 6.2 สร้าง `src/lib/auth-api.ts` — login(), verifyToken(), getUsers(), createUser(), updateUser()
- [ ] 6.3 สร้าง `src/hooks/use-auth.ts` — useAuth hook (login, logout, currentUser, isAuthenticated)
- [ ] 6.4 สร้าง `src/components/providers/auth-provider.tsx` — AuthContext + Provider (wrap App)

## 7. Frontend: Login Page
- [ ] 7.1 สร้าง `src/pages/Login.tsx` — ฟอร์ม Employee ID + PIN
- [ ] 7.2 แก้ `src/App.tsx` — wrap ด้วย AuthProvider, redirect ไป Login ถ้ายังไม่ login

## 8. Frontend: Admin Panel
- [ ] 8.1 สร้าง `src/pages/AdminPanel.tsx` — หน้าจัดการ users
  - ตารางแสดง users ทั้งหมด
  - ฟอร์มเพิ่ม/แก้ไข user (เลือก employee, ตั้ง PIN, เลือก role, checkbox เมนู)
  - ปุ่ม enable/disable user

## 9. Frontend: Sidebar + Route Guard
- [ ] 9.1 แก้ `src/components/layout/sidebar.tsx` — filter เมนูตาม `allowedMenus` ของ user
- [ ] 9.2 แก้ `src/components/layout/main-layout.tsx` — เพิ่ม route guard (redirect ถ้าไม่มีสิทธิ์)
- [ ] 9.3 เพิ่มเมนู "Admin" ใน sidebar (แสดงเฉพาะ role=admin)
- [ ] 9.4 เพิ่มชื่อ user + ปุ่ม logout ที่ footer ของ sidebar

## 10. Frontend: Recorded By
- [ ] 10.1 แก้ `src/pages/SalesEntry.tsx` — แสดงชื่อผู้บันทึก (lock, ไม่แก้ได้) + ส่ง recorded_by ใน API call
- [ ] 10.2 แก้ `src/pages/StockReceiving.tsx` — เหมือนกัน
- [ ] 10.3 แก้ตารางประวัติ — แสดง column "ผู้บันทึก"

## 11. Frontend: Order Summary
- [ ] 11.1 แก้ `src/lib/sales-api.ts` — เพิ่ม getSalesGroupedByOrder()
- [ ] 11.2 แก้ `src/pages/SalesEntry.tsx` — เพิ่ม section "สรุปออเดอร์ล่าสุด"
  - แสดง 5-10 ออเดอร์ล่าสุด
  - แต่ละออเดอร์แสดง: order_id, วันที่, จำนวนรายการ, ยอดรวม
  - กดขยายเห็นรายละเอียดสินค้าในออเดอร์

## 12. Polish
- [ ] 12.1 ทดสอบ flow: login → เห็นเฉพาะเมนูที่มีสิทธิ์ → บันทึกข้อมูลมีชื่อผู้บันทึก → สรุปออเดอร์ถูกต้อง
- [ ] 12.2 Admin สร้าง user คนแรก (ตัวเอง) เป็น admin ได้
