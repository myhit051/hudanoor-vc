# Change: ส่งออกสินค้าเป็น CSV สำหรับระบบ HUDANOOR Live CF

## Why
ต้องนำสินค้า+สต๊อกพร้อมขายเข้าระบบไลฟ์ (ลูกค้าพิมพ์ "CF รหัส") โดยไม่ต้องพิมพ์เอง ระบบไลฟ์ต้องการ 1 รหัสต่อ 1 ตัวเลือก และรหัสต้องเป็น ตัวอักษร 1–4 + ตัวเลข 1–4 (`/^[A-Z]{1,4}\d{1,4}$/`) แต่ SKU หลังร้าน 1 ตัวใช้หลายสี/ไซส์ และบาง SKU ไม่เข้ารูปแบบ

## What Changes
- ตาราง `cf_codes` (sku, color, size → cf_code UNIQUE) — รหัสถาวร (บอสเลือก "ตั้งอัตโนมัติ แก้เองได้" 22 ก.ย. 2569)
  - อัตโนมัติ: SKU เข้ารูปแบบ → ต่อเลขลำดับ (A08 → A0801, A0802 ตามวันที่รับเข้าครั้งแรก) · ใช้ไม่ได้ → Z001, Z002…
- `GET /api/stock?view=cf` (ล็อกอิน) ตัวเลือกทั้งหมด + คงเหลือ (ไม่ติดลบ) + ราคาล็อตล่าสุด + รหัส (ตั้งให้ตัวที่ยังไม่มี)
- `PUT /api/stock?action=cf` แก้รหัส (ตรวจรูปแบบ + ไม่ซ้ำ → 409)
- หน้าสต๊อกคงเหลือ: ปุ่ม "ส่งออก CSV สำหรับ Live CF" → หน้าต่างแก้รหัส + ดาวน์โหลด
- CSV: UTF-8 BOM, CRLF, RFC 4180 · `product_name` = ชื่อล็อตแรกของ SKU + " (SKU)" · `variant` = "สี / ไซส์" หรือ "มาตรฐาน" · `stock` รวมตัวที่หมด (0) · คอลัมน์เสริม `sku`

## Impact
- `lib/cf-codes.js`, `lib/turso.js`, `api/stock.js`, `src/lib/stock-api.ts`, `src/components/stock/live-cf-export-dialog.tsx`, `src/pages/StockInventory.tsx`
- ตรวจกับ `parseProductImport` และ `parseCfComment` ของโปรเจกต์ `/root/projects/HUDANOOR-Live-CF-Platform` แล้ว (รับครบทุกแถว / อ่านรหัสจากคอมเมนต์ได้)
