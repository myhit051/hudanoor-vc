## 1. Data model
- [x] 1.1 เพิ่ม `salespersonNames?: string[]` ใน `BranchCommission` (`src/types/employee.ts`)

## 2. Backend — การคำนวณ (`api/payroll.js`)
- [x] 2.1 แก้ `loadIncomesForPeriod` ให้ SELECT `recorded_by` จากทั้ง `sales_orders` และ `legacy_sales` แล้ว map เป็น `recordedBy`
- [x] 2.2 เพิ่ม helper `salespersonMatcher` เทียบรายชื่อแบบ normalize (ใช้ `normName`)
- [x] 2.3 แก้ `calcEmployeeCommission`: ถ้า `salespersonNames` มีค่า ให้กรอง income ด้วย `recordedBy ∈ salespersonNames`
- [x] 2.4 แก้ logic รายงานคอม (action `report`, บล็อก inline) ให้ใช้เงื่อนไขเดียวกัน
- [x] 2.5 ตรวจ path สร้าง/regenerate payroll run + preview — ทั้งคู่ใช้ `calcEmployeeCommission` จึงครอบคลุมแล้ว

## 3. Frontend — UI (`src/pages/EmployeeManagement.tsx`)
- [x] 3.1 import `useUsers` ดึงรายชื่อ active user accounts
- [x] 3.2 เพิ่ม Popover + checkbox list "คิดคอมจากยอดของผู้บันทึก" ต่อแถวค่าคอม — ค่าเริ่มต้น "ทุกคน"
- [x] 3.3 อัปเดต `updateBranchCommission` ให้รับ `string[]` + helper `toggleCommissionSalesperson`
- [x] 3.4 แสดงสรุปผู้ใช้ที่เลือก + ปุ่มล้าง (ทุกคน) + helper text
- [x] 3.5 payload PUT `/api/employees` ส่ง `branchCommissions` ทั้งก้อนเป็น JSON อยู่แล้ว → `salespersonNames` carry through (ไม่ต้องแก้)

## 4. ตรวจสอบ
- [x] 4.1 `tsc --noEmit` ผ่าน (type ทั้งระบบ)
- [ ] 4.2 ทดสอบจริงในแอป: แถวไม่ระบุ user → ยอด/คอมเท่าเดิม
- [ ] 4.3 ทดสอบจริง: เลือก 1 คน / หลายคน → คิดเฉพาะยอดกลุ่มที่เลือก
- [ ] 4.4 ตรวจรายงานคอม (report) กับใบเงินเดือน (payroll run) ให้ตัวเลขตรงกัน
