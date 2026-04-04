## 1. Backend — Database & API

- [x] 1.1 `lib/turso.js` — เพิ่ม `initSalesSchema()` สร้าง table `sales_orders`
- [x] 1.2 `api/stock.js` — เพิ่ม query param `available=true` คืน stock_in พร้อม available_quantity (stock_in.quantity - ยอดขาย)
- [x] 1.3 `api/stock.js` — เพิ่ม query param `view=inventory` คืน aggregated (total_in, total_sold, remaining) จัดกลุ่มตาม sku+color+size
- [x] 1.4 สร้าง `api/sales.js` — GET (list with filters), POST (insert + deduct stock, batch), DELETE (remove + restore stock, batch)

## 2. Frontend — API Layer & Hooks

- [x] 2.1 สร้าง `src/lib/sales-api.ts` — type `SalesOrder`, `NewSalesOrder`, functions: `getSalesOrders`, `addSalesOrder`, `deleteSalesOrder`
- [x] 2.2 สร้าง `src/hooks/use-sales.ts` — React Query hooks สำหรับ sales (useQuery + useMutation)
- [x] 2.3 ขยาย `src/lib/stock-api.ts` — เพิ่ม `getAvailableStock()` และ `getStockInventory()` functions

## 3. Frontend — หน้า SalesEntry

- [x] 3.1 สร้าง `src/pages/SalesEntry.tsx`
  - วันที่ขาย (DatePicker)
  - Channel select → branch_or_platform select (ดึงจาก settings)
  - Combobox searchable เลือกสินค้าจาก available stock (SKU/ชื่อ)
  - Auto-fill: product_name, color, size, unit_price
  - quantity input
  - discount_type toggle (บาท / %) + discount_value input
  - แสดง final_unit_price และ total_amount แบบ real-time
  - note input
  - ปุ่มบันทึก + บันทึกและล้างฟอร์ม
- [x] 3.2 ตารางประวัติการขายในหน้า SalesEntry — แสดงรายการ + สรุปยอดรวมวันนี้
- [x] 3.3 ปุ่มลบรายการขายในตาราง

## 4. Frontend — หน้า StockInventory

- [x] 4.1 สร้าง `src/pages/StockInventory.tsx`
  - ตารางแสดง SKU, ชื่อ, สี, ไซส์, รับเข้า, ขายออก, คงเหลือ
  - Badge/highlight แถวที่ remaining = 0
  - สรุปยอดรวม (total SKUs, total remaining pieces)

## 5. Navigation

- [x] 5.1 `src/components/layout/sidebar.tsx` — เพิ่มเมนู "บันทึกยอดขาย" (`ShoppingCart` icon) และ "สต๊อกคงเหลือ" (`Package` icon)
- [x] 5.2 `src/components/layout/main-layout.tsx` — เพิ่ม case `sales-entry` และ `stock-inventory` ใน renderCurrentPage
