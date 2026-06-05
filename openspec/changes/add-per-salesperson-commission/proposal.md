# Change: คิดค่าคอมจากยอดขายเฉพาะของพนักงานที่ระบุได้ (per-salesperson commission)

## Why
ปัจจุบันค่าคอมในหน้า `/employees` คำนวณจาก **ยอดขายรวมทุกคน** ในช่องทาง/สาขานั้น ไม่ว่าใครเป็นผู้บันทึก ทำให้พนักงานหน้าร้านหลายคนในสาขาเดียวกันได้คอมจากยอดเดียวกันซ้ำ ๆ และคิดคอมแบบ "เฉพาะยอดของคนขายคนนั้นเอง" ไม่ได้ ต้องการให้แต่ละแถวค่าคอมเลือกได้ว่าจะคิดจากยอดขายของ user คนไหนบ้าง (อิงจาก `recorded_by`).

## What Changes
- เพิ่มฟิลด์ `salespersonNames?: string[]` ใน `BranchCommission` (ว่าง/ไม่ระบุ = คิดจากทุกคนเหมือนเดิม — backward compatible)
- UI หน้า `EmployeeManagement.tsx` (Section ค่าคอม) เพิ่ม **multi-select เลือกผู้ใช้ (ผู้บันทึก)** ต่อแถวค่าคอม:
  - มีตัวเลือก "ทุกคน (ยอดรวมทั้งสาขา)" เป็นค่าเริ่มต้น
  - หรือเลือก user account ได้หลายคน → คิดคอมเฉพาะยอดที่ user เหล่านั้นบันทึก
  - รายชื่อ user ดึงจาก `useUsers` (active user accounts) ซึ่งตรงกับค่า `recorded_by` ที่บันทึกจริง
- การคำนวณใน `api/payroll.js`:
  - `loadIncomesForPeriod` โหลดคอลัมน์ `recorded_by` เพิ่ม (ปัจจุบันยังไม่ได้โหลด)
  - `calcEmployeeCommission` และ logic รายงานคอม (action `report`) เพิ่มเงื่อนไขกรองตาม `salespersonNames` เมื่อมีการระบุ
- ไม่ต้องแก้ schema DB (`branch_commissions` เก็บเป็น JSON อยู่แล้ว)

## Impact
- Affected specs: `employee-commission` (ใหม่)
- Affected code:
  - `src/types/employee.ts` — เพิ่ม `salespersonNames?: string[]` ใน `BranchCommission`
  - `api/payroll.js` — `loadIncomesForPeriod` (เพิ่ม `recorded_by`), `calcEmployeeCommission`, action `report`
  - `src/pages/EmployeeManagement.tsx` — UI multi-select ผู้ใช้ต่อแถวค่าคอม + helper `updateBranchCommission`
  - (อาจ) `src/components/ui/*` — ใช้ multi-select/combobox ที่มีอยู่หรือทำ chips select เบา ๆ
- ไม่กระทบข้อมูลเดิม: แถวค่าคอมเดิมที่ไม่มี `salespersonNames` ยังคิดจากทุกคนเหมือนเดิม
