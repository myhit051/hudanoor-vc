# Design: Sales Entry & Stock Inventory

## Context
ระบบปัจจุบันใช้ Turso DB เก็บข้อมูล `stock_in` (สินค้าที่รับเข้าคลัง) และ Google Sheets สำหรับรายรับ-รายจ่าย ต้องการเพิ่มระบบบันทึกยอดขายที่เชื่อมกับ `stock_in` เพื่อคำนวณสต๊อกคงเหลือ

## Goals / Non-Goals
- Goals:
  - บันทึกยอดขายโดยอ้างอิงสินค้าจากสต๊อกจริง
  - หักสต๊อกอัตโนมัติเมื่อบันทึกการขาย
  - คำนวณส่วนลด (บาท หรือ %) และราคาสุทธิ real-time
  - แสดงหน้าสต๊อกคงเหลือ (stock_in.quantity - ยอดขายรวม)
  - ประวัติการขายพร้อมยอดรวมต่อวัน/สาขา
- Non-Goals:
  - ไม่รวม multi-item cart ในครั้งเดียว (บันทึกทีละรายการ)
  - ไม่รวม return/refund workflow

## Database Schema

### `sales_orders` table
```sql
CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                    -- YYYY-MM-DD
  channel TEXT NOT NULL DEFAULT '',       -- 'store' | 'online'
  branch_or_platform TEXT NOT NULL DEFAULT '',
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  size TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,    -- ราคาต่อชิ้นก่อนส่วนลด
  discount_type TEXT NOT NULL DEFAULT 'amount',  -- 'amount' | 'percent'
  discount_value REAL NOT NULL DEFAULT 0,        -- ค่าส่วนลดที่กรอก
  discount_amount REAL NOT NULL DEFAULT 0,       -- ส่วนลดจริงเป็นบาท
  final_unit_price REAL NOT NULL DEFAULT 0,      -- ราคาต่อชิ้นหลังส่วนลด
  total_amount REAL NOT NULL DEFAULT 0,          -- final_unit_price × quantity
  note TEXT DEFAULT '',
  stock_in_id TEXT,                              -- FK อ้างอิง stock_in.id
  created_at TEXT NOT NULL
)
```

### สต๊อกคงเหลือ — คำนวณ runtime
```
คงเหลือ = SUM(stock_in.quantity) - SUM(sales_orders.quantity)
จัดกลุ่มตาม sku + color + size
```
ไม่สร้าง materialized view เพราะข้อมูลไม่ใหญ่ — query ตรงๆ พอ

## Decisions

### การหักสต๊อก
- เมื่อ POST `/api/sales` สำเร็จ → ลด `quantity` ใน `stock_in` ที่ตรงกับ `stock_in_id`
- ถ้า quantity ใน `stock_in` < quantity ที่ขาย → ส่ง error 400 กลับ
- ทำใน transaction เดียวกัน (Turso รองรับ batch execute)

### Combobox ค้นหาสินค้า
- ดึงสต๊อกที่มี quantity > 0 จาก `/api/stock?available=true`
- Group by SKU แต่แสดงแต่ละแถว (ต่างสี/ไซส์) เพื่อให้เลือกได้ถูกต้อง
- เมื่อเลือกแล้ว auto-fill: product_name, color, size, unit_price, stock_in_id

### ส่วนลด
- Toggle ระหว่าง "บาท" / "%" 
- คำนวณ real-time:
  - แบบบาท: `final_unit_price = unit_price - discount_value`
  - แบบ %: `final_unit_price = unit_price × (1 - discount_value/100)`
- `total_amount = final_unit_price × quantity`

## Risks / Trade-offs
- หัก `stock_in.quantity` ตรงๆ → ถ้า delete sales_order ต้องคืนสต๊อกด้วย
  - Mitigation: DELETE `/api/sales/:id` ต้อง restore quantity ใน stock_in
- Combobox โหลดสต๊อกทั้งหมด → อาจช้าถ้าสินค้าหลายพันรายการ
  - Mitigation: จำกัด query 500 รายการ + มี search filter ฝั่ง API

## Migration Plan
- ไม่มี breaking change กับข้อมูลเดิม
- `initSalesSchema()` ใช้ `CREATE TABLE IF NOT EXISTS` — ปลอดภัย
- เพิ่ม column `available_quantity` (computed) ใน stock API response
