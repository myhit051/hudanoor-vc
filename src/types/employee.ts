export interface BranchCommission {
  channel: 'store' | 'online';
  branchOrPlatform: string;
  commissionRate: number;
  // รายชื่อ user account (ผู้บันทึก/recorded_by) ที่จะคิดคอมจากยอดขายของคนเหล่านั้นเท่านั้น
  // ว่าง/ไม่ระบุ = คิดจากยอดรวมทุกคนในช่องทาง/สาขานั้น (พฤติกรรมเดิม)
  salespersonNames?: string[];
}

export interface SecondaryBranch {
  channel: 'store' | 'online';
  branchOrPlatform: string;
}

export interface Employee {
  id: string;
  name: string;
  position: string;
  salary: number;
  homeBranch: string;                       // สาขาประจำ — ใช้กำหนดสังกัด/แบ่งกลุ่มในใบเงินเดือน
  secondaryBranches: SecondaryBranch[];     // สาขารอง — ใช้กำหนดสาขาที่พนักงานช่วยขายเพิ่ม
  branchCommissions: BranchCommission[];    // อัตราค่าคอมตามสาขา/แพลตฟอร์ม
  startDate: string;
  isActive: boolean;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeCommissionReport {
  employeeId: string;
  employeeName: string;
  position?: string;
  homeBranch?: string;
  period: string;
  storeSales: number;
  onlineSales: number;
  storeCommission: number;
  onlineCommission: number;
  totalCommission: number;
  salary: number;
  totalEarnings: number;
  branchCommissions?: BranchCommission[];
}
