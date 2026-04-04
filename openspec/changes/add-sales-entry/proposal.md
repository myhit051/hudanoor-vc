# Change: เพิ่มหน้าบันทึกยอดขายพนักงาน และหน้าดูสต๊อกคงเหลือ

## Why
พนักงานต้องการบันทึกยอดขายได้สะดวก โดยดึงข้อมูลจากสต๊อกจริงและคำนวณส่วนลด/ราคาสุทธิอัตโนมัติ รวมถึงระบบต้องหักสต๊อกคงเหลืออัตโนมัติและมีหน้าแสดงสต๊อกคงเหลือแยกต่างหาก

## What Changes
- เพิ่ม table `sales_orders` ใน Turso DB สำหรับบันทึกยอดขาย
- เพิ่ม API endpoint `/api/sales.js` (GET, POST, DELETE)
- ขยาย `/api/stock.js` ให้รองรับการหักสต๊อกเมื่อมีการขาย (stock deduction)
- เพิ่มหน้า `SalesEntry.tsx` สำหรับบันทึกยอดขาย:
  - Combobox searchable ค้นหาสินค้าจากสต๊อกจริง (SKU/ชื่อ)
  - Auto-fill ชื่อสินค้า, สี, ไซส์, ราคาขาย
  - เลือกสาขา/ช่องทางจาก settings
  - ส่วนลดแบบบาทหรือ % เลือกได้ คำนวณราคาสุทธิ real-time
  - ตารางประวัติการขายพร้อมยอดรวมต่อวัน
- เพิ่มหน้า `StockInventory.tsx` แสดงสต๊อกคงเหลือ (รับเข้า - ขายออก) จัดกลุ่มตาม SKU

## Impact
- Affected specs: `sales-entry` (ใหม่), `stock-inventory` (ใหม่)
- Affected code:
  - `lib/turso.js` — เพิ่ม `initSalesSchema()`, `initStockInventoryView()`
  - `api/stock.js` — เพิ่ม deduction logic
  - `api/sales.js` — ใหม่
  - `src/lib/sales-api.ts` — ใหม่
  - `src/hooks/use-sales.ts` — ใหม่
  - `src/pages/SalesEntry.tsx` — ใหม่
  - `src/pages/StockInventory.tsx` — ใหม่
  - `src/components/layout/sidebar.tsx` — เพิ่มเมนู 2 รายการ
  - `src/components/layout/main-layout.tsx` — เพิ่ม route 2 หน้า
