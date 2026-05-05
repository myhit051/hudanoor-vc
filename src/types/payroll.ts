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
  totalAmount: number;                  // salary + totalCommission + adjustment
  commissionBreakdown: PayrollCommissionLine[];
  adjustment: number;                   // โบนัส/หักเพิ่ม (+/-)
  adjustmentNote: string;
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
  status: PayrollItemStatus;
}
