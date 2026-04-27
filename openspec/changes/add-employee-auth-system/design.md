## Context
ระบบ Hudanoor VC ปัจจุบันเป็น single-user app ที่ไม่มี authentication ต้องเพิ่มระบบ login + role-based access + order grouping

### Constraints
- ไม่ใช้ external auth provider (Firebase, Auth0) — เพื่อความเรียบง่าย
- ใช้ Employee ID + PIN เป็น credentials
- Session ใช้ JWT token เก็บใน localStorage
- Admin เป็นคนเดียว (owner) — hardcode role=admin สำหรับ user คนแรก
- ข้อมูลเก่าที่ไม่มี recorded_by / order_id ต้องใช้งานต่อได้ (backward compatible)

## Goals / Non-Goals

### Goals
- พนักงานต้อง login ก่อนใช้งาน
- Admin สามารถจัดการสิทธิ์เมนูของพนักงานแต่ละคนได้
- ทุก record มีชื่อผู้บันทึก
- ยอดขายจัดกลุ่มเป็นออเดอร์/ใบเสร็จได้

### Non-Goals
- ไม่ทำ password recovery / forgot PIN
- ไม่ทำ multi-admin (admin มีคนเดียว)
- ไม่ทำ audit log ละเอียด (เก็บแค่ชื่อผู้บันทึก)
- ไม่ทำ token refresh — token ยาว 30 วัน, หมดแล้ว login ใหม่

## Decisions

### 1. Authentication: JWT + PIN
- **Decision:** ใช้ Employee ID + 4-6 digit PIN → server verify → return JWT
- **Why:** เรียบง่ายที่สุด เหมาะกับพนักงานร้าน ไม่ต้องจำ password ซับซ้อน
- **Alternatives:**
  - Firebase Auth: ซับซ้อนเกินไป ต้อง setup OAuth
  - Cookie-based session: Vercel serverless ไม่เหมาะกับ stateful session

### 2. Storage: Turso (ไม่ใช่ Google Sheets)
- **Decision:** เก็บ `users` table ใน Turso (เหมือน stock/sales)
- **Why:** PIN ต้อง hash ก่อนเก็บ — Google Sheets ไม่เหมาะสำหรับ sensitive data + ต้องการ query performance
- **PIN hashing:** ใช้ SHA-256 (built-in crypto ใน Node.js) เพราะ PIN สั้น 4-6 digits ไม่จำเป็นต้องใช้ bcrypt

### 3. Permission Model: Menu-level ACL
- **Decision:** เก็บ `allowed_menus` เป็น JSON array ใน users table
- **Structure:** `["dashboard", "sales-entry", "stock-receiving", ...]`
- **Why:** เรียบง่าย ไม่ต้องสร้าง permission/role table แยก
- **Frontend:** Sidebar filter เมนูตาม allowed_menus, route guard redirect ไป 403

### 4. Order Grouping: order_id column
- **Decision:** เพิ่ม `order_id` TEXT column ใน `sales_orders`
- **Format:** `ORD-{YYYYMMDD}-{seq}` เช่น `ORD-20260426-001`
- **Generation:** Server-side ใน POST `/api/sales` — query max seq ของวันนั้น + 1
- **Why:** ง่ายต่อการอ้างอิง อ่านง่าย

### 5. Session Storage: localStorage
- **Decision:** เก็บ JWT ใน localStorage
- **Why:** ง่ายที่สุด, ระบบนี้ใช้ภายในร้านไม่ได้ expose สู่สาธารณะ
- **Token payload:** `{ userId, employeeId, name, role, allowedMenus, iat, exp }`
- **Expiry:** 30 วัน

## Risks / Trade-offs
- **PIN 4-6 digits ไม่ปลอดภัยมาก** → ยอมรับได้เพราะเป็นระบบภายในร้าน + ใช้บน network ที่เชื่อถือได้
- **JWT ใน localStorage** → XSS risk ต่ำเพราะไม่มี user-generated content
- **SHA-256 สำหรับ PIN** → ไม่เท่า bcrypt แต่เพียงพอสำหรับ internal app
- **No refresh token** → พนักงานต้อง login ใหม่ทุก 30 วัน

## Migration Plan
1. เพิ่ม columns ใหม่ใน `initSchema()` — ใช้ `ALTER TABLE ... ADD COLUMN ... DEFAULT ''` สำหรับ backward compat
2. สร้าง `users` table ใหม่
3. Deploy backend ก่อน → frontend ทีหลัง
4. Admin สร้าง users ผ่านหน้า Admin Panel
5. ข้อมูลเก่าที่ไม่มี `recorded_by` / `order_id` จะแสดงเป็น "-" ใน UI

## Open Questions
- ไม่มี — ข้อมูลครบแล้ว
