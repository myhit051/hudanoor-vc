<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# HUDANOOR — คู่มือสำหรับ AI ที่มาทำต่อ

ระบบหลังร้านของร้านเสื้อผ้าแฟชั่นมุสลิม HUDANOOR: รับของเข้าสต๊อก → บันทึกยอดขาย → จัดส่ง/ใบปะหน้า → ประวัติขาย/กำไร → เงินเดือน+คอม
เจ้าของร้าน (เรียกว่า "บอส") ไม่ใช่โปรแกรมเมอร์ — ตอบภาษาไทยง่าย ๆ เลี่ยงศัพท์เทคนิค

## ไฟล์เสริม (อ่านเมื่อจำเป็น)
- `AI_HISTORY.md` — ประวัติคำขอของบอสทีละเรื่อง (17 ก.ย.–2 ต.ค. 2026) + เหตุผล + **งานค้าง (ท้ายไฟล์)** → อ่านก่อนแก้ฟีเจอร์ขาย/จัดส่ง/ค่าส่ง/COD/สต๊อก/Live CF/เงินเดือน และก่อนเสนอไอเดียใหม่ (อาจเคยเสนอ/ปฏิเสธไปแล้ว)
- `AI_PAYROLL.md` — สูตรเงินเดือน/คอม/การลา/OT ทีละขั้น, ค่าตั้ง, สรุปสัญญาจ้าง, จุดที่ต้องแก้พร้อมกัน → **อ่านก่อนแตะเงินเดือน การลา OT รายงานคอม**
- `AI_TESTING.md` — วิธีทดสอบ API กับ SQLite จำลอง และทดสอบหน้าเว็บด้วย Playwright + API ปลอม → อ่านก่อนทดสอบทุกครั้ง
- `openspec/changes/*` — ข้อเสนอฟีเจอร์ (ล่าสุด `add-employee-leaves`, `add-live-cf-export`) → อัปเดตเมื่อเพิ่มฟีเจอร์ใหญ่
- `AGENTS.md` = บล็อก OpenSpec ของเครื่องมือ openspec (Codex อ่านไฟล์นั้น) — ไม่ใช่คู่มือโปรเจกต์ อย่าเขียนซ้ำ · Codex/AI อื่นที่ไม่อ่าน CLAUDE.md อัตโนมัติ ให้เปิดไฟล์นี้เอง

## ลิงก์สำคัญ
- https://hudanoor-vc.vercel.app — เว็บจริง (Vercel)
  - `/sales-entry` บันทึกยอดขาย · `/order-history` ประวัติการขาย+กำไร · `/shipping` จัดส่ง/พิมพ์ใบปะหน้า
  - `/stock-receiving` รับของ · `/stock-inventory` สต๊อกคงเหลือ · `/stock-value` มูลค่าสต๊อก · `/stock-movements` ความเคลื่อนไหวสต๊อก · `/employees` จัดการพนักงาน+รายงานคอม · `/payroll` จ่ายเงินเดือน+ใบแจ้ง PDF (admin) · `/leaves` เมนู "การลา / OT" + ค่าตั้งตัวหาร/ค่า OT (admin) · `/settings`
  - `/api/*` = Vercel serverless functions ในโฟลเดอร์ `api/`
- https://github.com/myhit051/hudanoor-vc — repo (branch `main`) **push แล้ว Vercel deploy เองอัตโนมัติ** ไม่ต้องใช้ azhub-publish / pm2
- `/root/projects/HUDANOOR-Live-CF-Platform` — ระบบไลฟ์ขาย CF ของร้าน (โปรเจกต์แยก รันบน VPS นี้ด้วย pm2 `hudanoor-dashboard`) รับไฟล์ CSV สินค้าจากหน้าสต๊อกคงเหลือ · **อ่านโค้ดได้ ห้ามแก้จากโปรเจกต์นี้** — งานฝั่งนั้นส่งต่อด้วยไฟล์ handoff
- `/root/projects/handoffs/` — ไฟล์ส่งต่องานข้ามโปรเจกต์ (`~/.claude/handoffs/` เขียนไม่ได้ ติดสิทธิ์) · ล่าสุด `2026-09-22-live-cf-flexible-variant-comments.md`
- https://amir-hudanoor-mockup.azhub.co — หน้า mockup ตารางสินค้า (pm2 `hudanoor-mockup`, `/root/projects/hudanoor-mockup`) ใช้เสร็จแล้ว ปิดได้ถ้าบอสไม่ใช้

## สถาปัตยกรรมย่อ
- หน้าเว็บ: Vite + React + TS + shadcn/ui + Tailwind + react-query (`src/`)
  - เพิ่มหน้าใหม่ต้องแก้ 3 จุด: `src/components/layout/main-layout.tsx` (route), `sidebar.tsx` (เมนู), `src/components/employees/employee-accounts.tsx` (`MENU_OPTIONS` สิทธิ์เมนู)
- API: `api/*.js` (Node, ESM) · ฐานข้อมูล Turso/libSQL ผ่าน `lib/turso.js`
  - **มี 12 ไฟล์ = เพดานฟังก์ชันของ Vercel ฟรีแล้ว ห้ามเพิ่มไฟล์ใน `api/`** → ใส่เป็น `action` ในไฟล์เดิม (เช่น การลาอยู่ใน `api/payroll.js`)
  - ตารางใหม่/คอลัมน์ใหม่ → เพิ่มใน `migrations` ของ `initSchema()` (ALTER TABLE ... ถูกกลืน error ถ้ามีแล้ว) ไม่มีระบบ migration อื่น
- Settings ร้าน (ชื่อ/เบอร์/ที่อยู่ร้าน, สาขาตามช่องทาง) เก็บใน Google Sheets ผ่าน `api/settings.js` → `useSettings()` (`storeName`, `storePhone`, `storeAddress`, `branchesByChannel`)
- Auth: JWT (`lib/jwt.js`, `lib/auth-middleware.js`) · หน้าเว็บเก็บ token ใน `localStorage.token` และส่ง `Authorization: Bearer` ทุก request
- `recorded_by` = **account_name** ของบัญชีพนักงาน (`employees.account_name`, `account_active = 1`) ใช้คิดค่าคอม — ห้ามเปลี่ยนเป็นชื่อพนักงาน

## ความลับ / ENV (ห้ามเขียนค่าลงไฟล์)
- เก็บใน Vercel → Project Settings → Environment Variables (ในเครื่องไม่มี `.env` จริง มีแค่ `.env*.example`)
- ชื่อที่ใช้: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `GOOGLE_CLIENT_EMAIL`/`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`/`GOOGLE_SHEETS_ID`, `GCS_BUCKET_NAME`

## โมเดลข้อมูลการขาย (`sales_orders`) — ต้องเข้าใจก่อนแตะ
- 1 แถว = 1 รายการสินค้า · หลายแถวที่ `order_id` เดียวกัน = 1 ออเดอร์ (`groupSalesByOrder()` ใน `src/lib/sales-api.ts`)
- เลขออเดอร์ `ORD-YYYYMMDD-NNN` จองผ่านตาราง `order_counters` (atomic, ไม่ลดลงเมื่อลบ) — **ห้ามกลับไปใช้ COUNT+1** (เคยทำเลขซ้ำ)
- `total_amount` ของแถว = ราคาสุทธิ×จำนวน (+ `shipping_fee` เฉพาะแถวแรกของออเดอร์) → ทุกหน้ารวมยอดจาก `total_amount`
- ค่าส่ง (`shipping_fee`) = **ต่อออเดอร์** ใส่ครั้งเดียว เซิร์ฟเวอร์ใช้ค่าจาก `items[0]` เท่านั้น · นับเป็นยอดขาย แต่ **ไม่นับเป็นกำไร** (หักออกใน `OrderHistory.tsx`)
- `shipping_status`: `pending` (รอส่ง) | `preparing` (เตรียมจัดส่ง — ตั้งอัตโนมัติเมื่อพิมพ์ใบปะหน้า เฉพาะออเดอร์ที่ยัง `pending`) | `shipped` (ส่งแล้ว) | `returned` (ตีกลับ) — อัปเดตทั้งออเดอร์ด้วย `PATCH /api/sales {order_ids, shipping_status}` (ใครล็อกอินก็ทำได้)
- `payment_method`: `transfer` | `cod` — COD ได้เฉพาะ `channel = 'online'` · ยอดเก็บ COD = total ของออเดอร์ (รวมค่าส่ง) · ย้ายเป็นหน้าร้านแล้วรีเซ็ตเป็น transfer และล้างที่อยู่
- `shipping_address` เก็บเฉพาะออนไลน์ · ออเดอร์เก่า (ก่อน 17 ก.ย. 2026) ไม่มีที่อยู่ และสถานะเริ่มต้นเป็น "รอส่ง" ทั้งหมด
- `stock_movements` = **ประวัติ**ความเคลื่อนไหวสต๊อก (ไม่ใช่ตัวคำนวณคงเหลือ — คงเหลือยังเป็น `stock_in − sales_orders`) · ทุก API ที่เพิ่ม/แก้/ลบ `stock_in` หรือ `sales_orders` **ต้อง** ใส่ `movementStmt()` (`lib/stock-movements.js`) ใน `db.batch` เดียวกัน · ประวัติแก้/ลบเริ่ม 19 ก.ย. 2026
- แก้สินค้าในออเดอร์ = `PUT /api/sales?order_id=` (Admin/ผู้บันทึก) ลบแถวเดิมแล้วสร้างใหม่ คง order_id วันที่ ช่องทาง ที่อยู่ COD สถานะจัดส่ง ผู้บันทึก created_at · หน้าต่าง `EditOrderItemsDialog` ในหน้าประวัติการขาย
- ตารางสินค้าในออเดอร์ใช้ร่วมกันที่ `src/components/sales/order-items-editor.tsx` (หน้าบันทึกยอดขาย + หน้าต่างแก้ไข)
- ส่งออกไประบบไลฟ์ `HUDANOOR Live CF` (โปรเจกต์ `/root/projects/HUDANOOR-Live-CF-Platform` บน VPS นี้): หน้าสต๊อกคงเหลือ → ปุ่ม "ส่งออก CSV สำหรับ Live CF" · รหัส CF ถาวรในตาราง `cf_codes` ต่อ sku+สี+ไซส์ (`lib/cf-codes.js`) ต้องตรง `/^[A-Z]{1,4}\d{1,4}$/` เพราะตัวอ่านคอมเมนต์ในไลฟ์ (`packages/domain-cf/src/parser.ts`) อ่านได้แค่นี้ · **ห้ามเปลี่ยนรหัสที่ตั้งแล้วอัตโนมัติ** (ระบบไลฟ์ใช้รหัสจับคู่สินค้า) · ตรวจไฟล์ด้วย `parseProductImport` ของระบบไลฟ์ (รันด้วย tsx ของโปรเจกต์นั้น) · CSV มีคอลัมน์เสริม `product_code` (SKU ที่เข้ารูปแบบ, ไม่งั้นว่าง) `color` `size` `sku` ไว้ให้ระบบไลฟ์จับคู่คอมเมนต์ "A08 ดำ M" (22 ก.ย. 2026 บอสให้ส่งต่องานฝั่งไลฟ์ให้ AI ของโปรเจกต์นั้น — ห้ามแก้โปรเจกต์ไลฟ์เองจากที่นี่)
- `legacy_sales` = ข้อมูลเก่าจาก Sheet/รายรับ manual — ไม่มี order_id, ไม่มีสถานะจัดส่ง, ถูกกรองออกจากหน้าจัดส่ง

## เงินเดือน · การลา · OT (สรุป — รายละเอียดเต็มอ่าน `AI_PAYROLL.md` ก่อนแตะ)
- ยอดรับ = เงินเดือน + คอม − หักลาเกิน + OT + ปรับปรุง · ทุกค่าเป็น snapshot ใน `payroll_items` ตอนสร้างรอบ/กด "คำนวณใหม่" · รอบที่ปิดแล้วไม่เปลี่ยน
- ลาในเดือนเกิน `commission_leave_limit` → ตัดคอมทั้งเดือน · ลาสะสม**ปีปฏิทิน**เกิน `leave_quota_yearly` → หักวันละ เงินเดือน ÷ ตัวหาร (ค่าตั้งทั้งร้าน ตอนนี้ 26) **หักจากคอมก่อน ไม่พอหักเงินเดือน** (บอสสั่ง แม้สัญญาเขียนหักเงินเดือน)
- ค่ารายคนที่ยังไม่ตั้ง (NULL) = **ไม่มีผลกับเงิน** · หยุดรายอ (`raya`) 3 วัน/ปีไม่นับเป็นวันลา · OT วันละ 100 (ตั้งได้) ใส่เป็นวันที่หรือยอดทั้งเดือน
- แก้ข้อมูลลา/OT/ค่าตั้ง → ต้องให้ผู้ใช้เห็นเตือน "คำนวณใหม่" (`runs[].stale`) ทุกเดือนร่างในปี · แก้ที่กระทบเดือนปิดรอบต้อง confirm
- ค่าตั้งของร้านที่ใช้คำนวณฝั่งเซิร์ฟเวอร์อยู่ตาราง `app_config` (Turso) — ตั้งค่าร้านทั่วไป (ชื่อ/ที่อยู่/สาขา) อยู่ Google Sheets

## กติกาที่ตกลงกับบอสแล้ว (อย่าเปลี่ยนเองโดยไม่ถาม)
- หน้าบันทึกยอดขาย:
  - สินค้าในออเดอร์ = **ตาราง** (19 ก.ย. 2026 บอสอนุมัติจาก mockup): ค้นหา → กดเลือก → เข้าตารางทันที (ไม่มีปุ่ม "เพิ่มลงรายการ") · เลือกตัวเดิมซ้ำ = จำนวน +1 ในแถวเดิม ไม่เกินสต๊อก · แก้จำนวน/ราคา/ส่วนลด(฿ หรือ %)/หมายเหตุในแถว · จอ < md เป็นการ์ด · ฟอร์มกว้าง 2/3 ที่ xl
  - ช่อง "ค่าส่ง" อยู่**ท้ายฟอร์ม** ใต้รายการสินค้าในตะกร้า ก่อนกล่องยอดรวมและปุ่มบันทึก (18 ก.ย. 2026 บอสขอให้กรอกตอนท้ายก่อนบันทึก — เดิมอยู่ใต้ช่องทาง/สาขา) · ยอดรวมต้องตรงกับสลิปโอน
  - กล่องยอดรวมแยก ค่าสินค้า / ค่าส่ง / ยอดรวมทั้งหมด (COD เปลี่ยนคำเป็น "ยอดเก็บเงินปลายทาง")
  - ปุ่ม "บันทึก → ออเดอร์ถัดไป" = คงวันที่ ช่องทาง สาขา ผู้บันทึก · ล้างสินค้า ฟอร์มสินค้า ค่าส่ง ที่อยู่ COD
  - ปุ่ม "บันทึกเสร็จสิ้น" (เดิมชื่อ "บันทึกและล้างทั้งหมด") = ล้างทุกอย่างแล้ว**พับฟอร์มเก็บ** อยู่หน้าเดิม เหลือปุ่ม "+ บันทึกออเดอร์ใหม่" ไว้เปิดฟอร์มอีกครั้ง (บอสเลือกแบบนี้ 18 ก.ย. 2026 — ไม่ย้ายไปหน้าอื่น)
  - Admin เลือก "ผู้บันทึก" เป็นบัญชีอื่นที่ active ได้ (เซิร์ฟเวอร์ตรวจ role + บัญชี) · พนักงานทั่วไปล็อกเป็นชื่อตัวเอง
- หน้าจัดส่ง:
  - ค่าเริ่มต้นแสดงเฉพาะออนไลน์ ย้อนหลัง 30 วัน · แท็บสถานะพร้อมจำนวน · สวิตช์ "เฉพาะออเดอร์ที่มีที่อยู่"
  - เลือกหลายออเดอร์ → PDF ใบปะหน้า 3 ขนาด: สติ๊กเกอร์ 100×150 มม. / A4 4 ใบ / A4 8 ใบ (แบบย่อ) · ข้ามออเดอร์ที่ไม่มีที่อยู่พร้อมแจ้งจำนวน
  - ผู้ส่งบนใบปะหน้ามาจากตั้งค่าร้าน · ออเดอร์ COD มีกรอบขอบดำพื้นขาว "COD เก็บเงินปลายทาง ฿…" ตัวใหญ่ (บอสไม่เอาพื้นดำ เปลืองหมึก)
  - เปลี่ยนสถานะรายออเดอร์ต้องไม่ล้างรายการที่ติ๊กไว้อื่น
- ความปลอดภัย: `GET` และ `POST /api/sales` ต้องล็อกอิน (ข้อมูลมีชื่อ/เบอร์/ที่อยู่ลูกค้า)
- `POST/PUT/DELETE /api/stock` ต้องล็อกอิน (19 ก.ย. 2026 บอสสั่งปิด) · `GET /api/stock` (มีต้นทุน) ยังเปิดอยู่ ยกเว้น `view=movements`
- `GET /api/employees` ต้องล็อกอิน · `GET /api/payroll` Admin เท่านั้น ยกเว้น `action=report` (รายงานคอมในหน้าจัดการพนักงาน) แค่ล็อกอิน (1 ต.ค. 2026 บอสสั่งปิด) — ฟังก์ชันหน้าเว็บที่เรียก API พวกนี้ต้องส่ง `authHeaders()`
- เมนูใหม่ต้องให้แอดมินเปิดสิทธิ์ให้พนักงานเองในหน้าจัดการพนักงาน — แจ้งบอสทุกครั้ง
- ฟีเจอร์ใหญ่ → บันทึกใน `openspec/changes/<ชื่อ>/` (proposal.md, tasks.md, specs/) ตามแบบที่มีอยู่ (ไม่มี openspec CLI ในเครื่อง)

## วิธีทำงานกับบอส (สิ่งที่เห็นแล้วว่าได้ผล)
- ตอบเป็นภาษาไทยเสมอ (เคยพลาดตอบภาษาอื่น บอสต้องสั่ง "สรุปมาภาษาไทย")
- คำขอกำกวมที่ทำได้หลายแบบ (เช่น "ปิดฟอร์ม", "export") → ถามพร้อมตัวเลือกก่อน อย่าเดา · เรื่องเล็กที่มีค่าที่ดีกว่าชัด ๆ ทำเลยแล้วบอก
- ถามหลายข้อแล้วบอสตอบแค่ข้อเดียว (กดปุ่ม) → ตัวเลขที่ไม่ได้ตอบ (เช่น วันลาที่ได้) ทำเป็นช่องให้บอสตั้งเอง ค่าเริ่มต้น "ยังไม่ตั้ง = ไม่มีผลกับเงิน" แล้วบอกบอสชัด ๆ ว่าต้องไปตั้งที่ไหน · ค่าที่เลือกแทนบอส (เช่น ปีปฏิทิน) ให้บอกและถามยืนยันท้ายรายงาน
- งานที่กระทบเงินพนักงาน → หลังทำเสร็จรัน `/scrutinize` ทวนเอง เคยเจอจุดเสี่ยงหักเงินผิดแบบไม่มีเตือน (2 ต.ค. 2026)
- งานหน้าจอใหญ่ → บอสชอบดู mockup HTML ก่อน (เผยแพร่ด้วย `azhub-publish` แล้วส่งลิงก์)
- เจอช่องโหว่/บั๊กนอกขอบเขต → แจ้งและถามก่อนแก้ (เช่นเรื่อง API สต๊อกไม่ต้องล็อกอิน)
- รวมงานหลายชิ้นแล้ว push ทีเดียว เพราะโควต้า deploy ของ Vercel จำกัดต่อวัน · บอกบอสตรง ๆ ถ้าติดโควต้า
- รายงานทุกครั้ง: ทำอะไร · ขึ้นเว็บแล้วหรือยัง · ทดสอบกับอะไร (จำลอง/จริง) · อะไรที่ยังไม่ได้ลอง · ค่าที่บอสต้องไปตั้งเองและตั้งที่ไหน
- บอสส่งเอกสารมาเฉย ๆ ไม่สั่ง (เช่น สัญญาจ้าง 2 ต.ค. 2026) → เทียบกับระบบ บอกจุดที่ไม่ตรง แล้วถามพร้อมปุ่มว่าจะให้ทำอะไร อย่าแก้เอง
- บอสถาม "ต้องแก้ตรงไหนในเว็บ" แล้วไม่มีช่องในเว็บ → บอกตรง ๆ แก้ให้ แล้วเสนอทำช่องตั้งค่า (บอสเลือกให้ทำช่องตั้งค่าตัวหาร)
- ตัวอย่างตัวเลขเงินจริง (เงินเดือน 8,000 คอม 1,000 ลา X วัน → ได้รับเท่าไหร่) ช่วยให้บอสตัดสินใจเร็ว — โดยเฉพาะกรณีโดนสองต่อ (ตัดคอม + หักลา)

## ข้อห้าม
- ห้ามสร้าง/ลบข้อมูลทดสอบบนเว็บจริงหรือฐานข้อมูลจริง → ทดสอบกับ SQLite จำลองและ API ปลอมเท่านั้น (ดู `AI_TESTING.md`) แล้วบอกบอสตรง ๆ ว่ายังไม่ได้ลองบันทึกจริง
- ห้ามเปิด API ขายให้เรียกได้โดยไม่ล็อกอิน · ห้ามใส่ความลับลงไฟล์/commit
- ห้ามคิดค่าส่งต่อสินค้า (นับซ้ำ) · ห้ามนับค่าส่งเป็นกำไร
- ห้ามใช้ `pkill -f "<ข้อความในคำสั่ง>"` — มันฆ่า shell ของตัวเองด้วย (exit 144) ใช้ `fuser -k <port>/tcp`
- ห้ามรัน build/tsc โดยไม่มี `capped` (ดูคำสั่งด้านล่าง)
- ไม่ต้อง publish ผ่าน azhub/pm2 — โปรเจกต์นี้อยู่บน Vercel

## กับดักที่เคยเสียเวลา + วิธีเลี่ยง
- `capped npm run build` ด้วยแรม 1G → V8 heap OOM (core dump) → ใช้ `CAP_MEM=2G capped npm run build`
- `tsc` มี error เดิมอยู่แล้ว (`UpdateLogs.tsx`, `theme-provider.tsx`, `settings-api.ts`) → กรองดูเฉพาะไฟล์ที่แก้: `... | grep -E "ไฟล์ที่แก้"`
- Playwright MCP (`mcp__playwright__*`) เปิดไม่ได้เพราะรันเป็น root ไม่มี `--no-sandbox` → เขียนสคริปต์ node ใช้ playwright-core เองพร้อม `args: ['--no-sandbox']` (ดู `AI_TESTING.md`)
- html2canvas กับภาษาไทย: `overflow:hidden` + `text-overflow: ellipsis` + line-height ต่ำ ทำให้ตัวอักษรถูกตัดขอบ → ใช้ line-height ≥1.6, padding ล่างเพิ่ม, ตัดข้อความด้วย JS แทน ellipsis
- CSS มือถือใน `src/index.css` บังคับ `button` สูง/กว้างขั้นต่ำ 44px → Checkbox/Switch บวม ต้องใส่ `className="min-h-0 min-w-0"`
- ฟิลด์ที่อยู่ใน section ที่แสดงแบบมีเงื่อนไข (`cart.length > 0`) จะโผล่หลังเพิ่มสินค้าแล้วเท่านั้น — ค่าส่งตั้งใจไว้ตรงนั้นตามที่บอสขอ ฟิลด์ระดับออเดอร์อื่นให้แสดงตลอด
- Vercel ฟรีจำกัดจำนวน deploy ต่อวัน — push ถี่ ๆ แล้วเว็บไม่อัปเดต ให้เช็ค `gh api repos/myhit051/hudanoor-vc/commits/<sha>/statuses` ถ้าขึ้น "Deployment rate limited" ต้องรอแล้ว push ใหม่ (Vercel ไม่ลองซ้ำเอง) · check `build-and-deploy` (GitHub Pages) fail ทุกครั้งอยู่แล้ว ไม่เกี่ยว
- 18 ก.ย. 2026 เว็บตอบ 403 "Vercel Security Checkpoint" กับ curl/Chrome headless จาก VPS นี้ → เช็ค asset ไม่ได้ ให้ใช้สถานะ deploy จาก `gh api .../commits/<sha>/statuses` ("Deployment has completed") แทน
- ตัวเช็คว่า deploy เสร็จ (ใช้ไม่ได้ตอนติด Security Checkpoint ข้างบน): หา asset `index-*.js` จากหน้าเว็บแล้ว grep ข้อความใหม่ (รอ ~1–3 นาที)
- ระบบไลฟ์อ่านรหัสจากคอมเมนต์ด้วย `/[a-z]{1,4}\d{1,4}/` — ตัวอักษรหลังตัวเลขถูกตัดทิ้ง (`A081M` → `A081` = ตัดสต๊อกผิดตัว) ห้ามออกแบบรหัสที่มีตัวอักษรท้าย · ทดสอบของจริงได้: `/root/projects/HUDANOOR-Live-CF-Platform/node_modules/.bin/tsx` + import `parseCfComment` (`packages/domain-cf/src/parser.ts`) / `parseProductImport` (`apps/api/src/csv-import.ts`)
- ทดสอบหน้าที่แก้ทั้ง API และ UI: ใน Playwright `ctx.route` เรียก handler จริงกับ SQLite (ดู `AI_TESTING.md` ข้อ 3) — เจอบั๊กที่ mock ไม่เจอ
- `vite preview` เก่าค้างพอร์ต 4179 → `fuser -k 4179/tcp` ก่อนรันใหม่ · Playwright `getByText` ชนหลายตัวบ่อย ใช้ `getByRole(..., { name })` / `getByLabel`
- ฟอร์มกว้างครึ่งจอทำให้ตารางบีบจนช่อง input หาย → ใช้ `table-fixed` + กำหนดความกว้างคอลัมน์ และให้ฟอร์มกว้าง 2/3
- CSS grid + ตารางกว้าง (`overflow-x-auto`) ในการ์ด → มือถือทั้งหน้าล้นแนวนอน ต้องใส่ `min-w-0` ที่การ์ดลูกของ grid (เจอในหน้า `/leaves`)
- สคริปต์ทดสอบ `.mjs`: `await import('.../playwright-core/index.js')` ได้ `chromium` เป็น undefined → ใช้ `createRequire(import.meta.url)('<path>/playwright-core')`
- ระบบลา: แก้ยอดลาเดือนก่อน ๆ ทำให้รอบเงินเดือนเดือนหลังเพี้ยน — ทุกที่ที่แก้ข้อมูลลา/โควตาต้องให้ผู้ใช้เห็นคำเตือน "คำนวณใหม่" (ใช้ `runs[].stale`) อย่าเช็คแค่เดือนที่เปิดอยู่
- Playwright `getByRole('button', { name: 'บันทึกการลา' })` ชนกับปุ่มเมนูด้านข้าง / ปุ่มประเภท "หยุดรายอ" ชนกับปุ่มตัวเลขในตารางทั้งปี → ใส่ `exact: true` หรือชื่อเต็ม เช่น `'บันทึกการลา (1 วัน)'`
- ทดสอบเงินเดือน: คิดตัวเลขคาดหวังเองแล้วพลาดบ่อย (ลืมว่า preview ไม่รวมปรับปรุง, บวกเลขผิด) → ถ้าไม่ตรงให้ไล่สูตรใน `AI_PAYROLL.md` ก่อนสรุปว่าโค้ดผิด
- เพิ่มค่าที่ snapshot ใน `payroll_items` แล้วลืมใส่ใน `leaveRunStatus()` = รอบร่างไม่เตือนให้คำนวณใหม่ → เงินผิดเงียบ ๆ · ค่าตั้งทั้งร้าน (ตัวหาร/ค่า OT) ให้เตือนเฉพาะรอบร่าง ไม่งั้นรอบที่ปิดแล้วขึ้นเตือนผิด
- แถวเก่าใน `payroll_items` ไม่มีคอลัมน์ใหม่ (NULL) → อ่านด้วยค่าเริ่มต้นของยุคนั้น (เช่น `leave_day_divisor` NULL = 25) ไม่ใช่ค่าปัจจุบัน
- เปิดหน้าเว็บที่ `localhost` แอปจะยิง API ไป `http://localhost:3000/api` → ทดสอบด้วย `vite preview --host 127.0.0.1` (จะใช้ `/api` ปกติ แล้ว mock ด้วย route)

## คำสั่งที่ใช้บ่อย
```bash
cd /root/projects/hudanoor-vc
CAP_MEM=2G capped npm run build                                   # build (ต้องผ่านก่อน push)
capped npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "SalesEntry|Shipping|OrderHistory|StockMovements|StockInventory|sales-api|stock-api|components/(sales|stock)"
node --check api/sales.js                                         # เช็ค syntax API (เงินเดือน: api/payroll.js)
rm -f /tmp/x.db && node /tmp/x.mjs                                # ทดสอบ handler จริงกับ SQLite จำลอง (แบบใน AI_TESTING.md)
npx vite preview --host 127.0.0.1 --port 4179 --strictPort        # รันแบบ background เพื่อทดสอบ UI
fuser -k 4179/tcp                                                 # ปิดเซิร์ฟเวอร์ทดสอบ
git add <ไฟล์> && git commit -m "feat: ..." && git push origin main   # push = deploy
# เช็คผล deploy (ตัวนี้เชื่อได้แม้เว็บติด Security Checkpoint) — success = ขึ้นแล้ว, "rate limited" = ติดโควต้า
sha=$(git rev-parse HEAD); gh api repos/myhit051/hudanoor-vc/commits/$sha/statuses --jq '.[0] | "\(.state) \(.description)"'
# (สำรอง) เช็คว่าข้อความใหม่ขึ้นจริง
js=$(curl -s https://hudanoor-vc.vercel.app/ | grep -o 'assets/index-[^"]*\.js' | head -1); curl -s "https://hudanoor-vc.vercel.app/$js" | grep -c "ข้อความใหม่"
curl -s -o /dev/null -w '%{http_code}' https://hudanoor-vc.vercel.app/api/sales   # ต้องได้ 401
curl -s -o /dev/null -w '%{http_code}' "https://hudanoor-vc.vercel.app/api/payroll?action=leaves&period=2026-10"   # ต้องได้ 401 (ข้อมูลการลา/เงินเดือน)
```
- ข้อความ commit เป็นภาษาไทยแบบ `feat:` / `fix:` ตามประวัติเดิม
