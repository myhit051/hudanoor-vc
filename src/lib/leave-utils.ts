import { LeaveType } from '@/types/payroll';

export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  sick: 'ลาป่วย',
  personal: 'ลากิจ',
  other: 'อื่น ๆ',
};

// 2 → "2", 1.5 → "1.5"
export const formatDays = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

// หักลาเกินจากคอมก่อน ส่วนที่คอมไม่พอหักจากเงินเดือน
export const splitLeaveDeduction = (deduction: number, commission: number) => {
  const fromCommission = Math.min(deduction, Math.max(0, commission));
  return { fromCommission, fromSalary: deduction - fromCommission };
};
