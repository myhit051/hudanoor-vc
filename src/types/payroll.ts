export type PayrollRunStatus = 'draft' | 'finalized';
export type PayrollItemStatus = 'pending' | 'paid';

export interface PayrollCommissionLine {
  channel: 'store' | 'online';
  branchOrPlatform: string;
  sales: number;
  rate: number;
  commission: number;
}

export interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  position: string;
  homeBranch: string;
  salary: number;
  totalCommission: number;
  totalAmount: number;                  // salary + totalCommission - leaveDeduction + adjustment
  commissionBreakdown: PayrollCommissionLine[];
  adjustment: number;                   // โบนัส/หักเพิ่ม (+/-)
  adjustmentNote: string;
  leaveDays: number;                    // วันลาในงวดนี้ (ตอนคำนวณล่าสุด)
  leaveQuota: number | null;            // วันลาที่ได้ (ต่อปี ถ้า leaveBasis = 'year') — null = ยังไม่ตั้ง (ไม่หัก)
  leaveExcessDays: number;
  leaveDeduction: number;               // หักลาเกิน (บวก) — หักจากคอมก่อน ไม่พอหักจากเงินเดือน
  leaveBasis: 'month' | 'year';         // 'month' = รอบที่คำนวณก่อน 2 ต.ค. 2026 (โควตาต่อเดือน)
  leaveUsedBefore: number;              // วันลาสะสมในปีนี้ก่อนเดือนนี้
  status: PayrollItemStatus;
  paidAt: string;
  paidBy: string;
  paidMethod: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRun {
  id: string;
  period: string;                       // YYYY-MM
  status: PayrollRunStatus;
  totalSalary: number;
  totalCommission: number;
  totalAmount: number;
  employeeCount: number;
  note: string;
  createdBy: string;
  finalizedAt: string;
  finalizedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollPreviewItem {
  employeeId: string;
  employeeName: string;
  position: string;
  homeBranch: string;
  salary: number;
  totalCommission: number;
  totalAmount: number;
  commissionBreakdown: PayrollCommissionLine[];
  leaveDays: number;
  leaveQuota: number | null;
  leaveExcessDays: number;
  leaveDeduction: number;
  leaveBasis: 'month' | 'year';
  leaveUsedBefore: number;
  status: PayrollItemStatus;
}

export type LeaveType = 'sick' | 'personal' | 'other';

export interface EmployeeLeave {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;                         // YYYY-MM-DD
  days: number;                         // 1 หรือ 0.5
  leaveType: LeaveType;
  isLump: boolean;                      // ยอดย้อนหลังทั้งเดือน ไม่ระบุวันที่
  note: string;
  recordedBy: string;
  createdAt: string;
}

export interface LeaveSummaryEmployee {
  id: string;
  name: string;
  position: string;
  homeBranch: string;
  salary: number;
  leaveQuota: number | null;            // วันลาที่ได้ต่อปี
  leaveDays: number;                    // เดือนที่เลือก
  usedBefore: number;                   // สะสมในปีก่อนเดือนที่เลือก
  months: number[];                     // วันลาแต่ละเดือนของปี (ม.ค.–ธ.ค.)
  yearDays: number;
  excessDays: number;
  dailyRate: number;                    // เงินเดือน ÷ 25
  deduction: number;                    // ยังไม่จำกัดเพดานตามยอดคอม+เงินเดือน (หน้าจ่ายเงินเดือนจำกัดให้)
}
