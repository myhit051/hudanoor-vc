## ADDED Requirements

### Requirement: Sales Order Recording
ระบบ SHALL บันทึกยอดขายผ่านหน้า SalesEntry โดยอ้างอิงสินค้าจากสต๊อกคงเหลือจริงใน Turso DB

#### Scenario: บันทึกยอดขายสำเร็จ
- **WHEN** พนักงานเลือกสินค้าจาก Combobox, กรอกข้อมูลครบ, กดบันทึก
- **THEN** ระบบบันทึก sales_order ลง Turso DB, หัก quantity ใน stock_in, แสดง toast สำเร็จ

#### Scenario: สต๊อกไม่พอ
- **WHEN** quantity ที่ขาย > quantity คงเหลือใน stock_in
- **THEN** ระบบปฏิเสธการบันทึกและแสดง error "สต๊อกไม่เพียงพอ"

### Requirement: Stock-Linked Product Selection
ระบบ SHALL ให้พนักงานเลือกสินค้าผ่าน Combobox แบบ searchable ที่ดึงข้อมูลจากสต๊อกที่มีคงเหลือ (quantity > 0)

#### Scenario: ค้นหาสินค้าจาก SKU
- **WHEN** พนักงานพิมพ์ SKU ใน Combobox
- **THEN** แสดงรายการสินค้าที่ตรงกันพร้อมสี, ไซส์, และจำนวนคงเหลือ

#### Scenario: Auto-fill เมื่อเลือกสินค้า
- **WHEN** พนักงานเลือกสินค้าจาก Combobox
- **THEN** ระบบ auto-fill ชื่อสินค้า, สี, ไซส์, ราคาขาย (unit_price) จาก stock_in

### Requirement: Discount Calculation
ระบบ SHALL คำนวณส่วนลดและราคาสุทธิ real-time รองรับทั้งแบบบาทและเปอร์เซ็นต์

#### Scenario: ส่วนลดแบบบาท
- **WHEN** พนักงานเลือก discount_type = "บาท" และกรอก discount_value
- **THEN** final_unit_price = unit_price - discount_value, total_amount = final_unit_price × quantity แสดงผลทันที

#### Scenario: ส่วนลดแบบเปอร์เซ็นต์
- **WHEN** พนักงานเลือก discount_type = "%" และกรอก discount_value
- **THEN** final_unit_price = unit_price × (1 - discount_value/100), total_amount แสดงผลทันที

### Requirement: Channel and Branch Selection
ระบบ SHALL ให้เลือกสาขา/ช่องทางการขายจากรายชื่อที่ตั้งค่าไว้ใน Settings (store branches และ online platforms)

#### Scenario: เลือกสาขาหน้าร้าน
- **WHEN** พนักงานเลือก channel = "หน้าร้าน"
- **THEN** Dropdown branch_or_platform แสดงรายชื่อ store branches จาก settings

#### Scenario: เลือกแพลตฟอร์มออนไลน์
- **WHEN** พนักงานเลือก channel = "ออนไลน์"
- **THEN** Dropdown branch_or_platform แสดงรายชื่อ online platforms จาก settings

### Requirement: Sales History View
ระบบ SHALL แสดงประวัติการขายพร้อมสรุปยอดรวมต่อวันในหน้า SalesEntry

#### Scenario: ดูประวัติการขายวันนี้
- **WHEN** พนักงานเปิดหน้า SalesEntry
- **THEN** แสดงตารางรายการขายทั้งหมด พร้อมสรุป: จำนวนรายการ, จำนวนชิ้น, ยอดขายรวม

#### Scenario: ลบรายการขาย
- **WHEN** พนักงานกดลบรายการขาย
- **THEN** ระบบลบ sales_order และคืน quantity กลับเข้า stock_in

### Requirement: Sales API
ระบบ SHALL มี API endpoint `/api/sales` รองรับ GET, POST, DELETE

#### Scenario: GET รายการขาย
- **WHEN** GET /api/sales พร้อม query params (date, sku, channel)
- **THEN** ส่งคืน array ของ sales_orders เรียงตาม date DESC

#### Scenario: POST บันทึกยอดขาย (transaction)
- **WHEN** POST /api/sales พร้อม body ที่ถูกต้อง
- **THEN** INSERT sales_order และ UPDATE stock_in.quantity ใน batch เดียว, ส่งคืน id ใหม่

#### Scenario: DELETE ลบยอดขาย (restore stock)
- **WHEN** DELETE /api/sales?id=xxx
- **THEN** DELETE sales_order และ restore quantity กลับ stock_in ใน batch เดียว
