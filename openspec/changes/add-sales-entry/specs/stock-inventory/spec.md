## ADDED Requirements

### Requirement: Stock Inventory Page
ระบบ SHALL มีหน้า StockInventory แสดงสต๊อกคงเหลือจริง คำนวณจาก stock_in.quantity รวม ลบด้วย sales_orders.quantity รวม จัดกลุ่มตาม SKU + สี + ไซส์

#### Scenario: ดูสต๊อกคงเหลือทั้งหมด
- **WHEN** พนักงานเปิดหน้า StockInventory
- **THEN** แสดงตารางสินค้าทุกรายการพร้อม: SKU, ชื่อ, สี, ไซส์, รับเข้า, ขายออก, คงเหลือ

#### Scenario: คงเหลือเป็นศูนย์หรือน้อย
- **WHEN** สต๊อกคงเหลือ = 0
- **THEN** แถวนั้นแสดงสีแดงหรือ badge "หมด" เพื่อเตือน

### Requirement: Stock Inventory API
ระบบ SHALL มี endpoint `/api/stock?view=inventory` ที่คืน aggregated stock data (received - sold = remaining)

#### Scenario: ดึงข้อมูลสต๊อกคงเหลือ
- **WHEN** GET /api/stock?view=inventory
- **THEN** ส่งคืน array ของ { sku, product_name, color, size, total_in, total_sold, remaining } เรียงตาม sku

### Requirement: Available Stock Filter
ระบบ SHALL รองรับ query param `available=true` บน GET /api/stock เพื่อกรองเฉพาะสินค้าที่ยังมีสต๊อกคงเหลือ > 0 (สำหรับ Combobox ในหน้า SalesEntry)

#### Scenario: ดึงสต๊อกที่ยังมีเหลือ
- **WHEN** GET /api/stock?available=true
- **THEN** ส่งคืนเฉพาะรายการที่ (stock_in.quantity - ยอดขาย) > 0 พร้อม field available_quantity
