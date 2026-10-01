// การลาของพนักงาน (ตาราง employee_leaves — 1 แถว = 1 วัน, days = 1 หรือ 0.5
// หรือ is_lump = 1: ยอดย้อนหลังทั้งเดือนไม่ระบุวันที่ date = วันที่ 1, days ได้ถึง 31)
// ลาสะสมในปีปฏิทินเกินวันที่ได้ต่อปี (employees.leave_quota_yearly) ถูกหักวันละ เงินเดือน ÷ 25
// — หักในเดือนที่ลาเกิน (เดือนก่อน ๆ ที่หักไปแล้วไม่หักซ้ำ)
// หักจากคอมก่อน ส่วนที่คอมไม่พอหักจากเงินเดือนต่อ — ยอดรับไม่ติดลบ

export const LEAVE_DAY_DIVISOR = 25;
export const LEAVE_TYPES = ['sick', 'personal', 'other'];
export const MAX_LEAVE_RANGE_DAYS = 31;
export const MAX_YEARLY_QUOTA = 366;

const round2 = (n) => Math.round(n * 100) / 100;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// วันที่ทุกวันตั้งแต่ start ถึง end (รวมทั้งสองวัน) — คืน null ถ้าช่วงยาวเกินกำหนด
export function expandDates(start, end) {
  const out = [];
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end || start}T00:00:00Z`);
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    if (out.length > MAX_LEAVE_RANGE_DAYS) return null;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function normalizeQuota(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// usedBefore = วันลาสะสมในปีเดียวกันก่อนเดือนนี้ · quota = วันลาที่ได้ต่อปี
// commission = null → ไม่จำกัดเพดาน (ใช้ในหน้าสรุปการลาที่ยังไม่รู้ยอดคอม)
export function calcLeaveDeduction({ salary, commission = null, quota, days, usedBefore = 0 }) {
  const pay = Number(salary) || 0;
  const leaveDays = Number(days) || 0;
  const before = Number(usedBefore) || 0;
  const q = normalizeQuota(quota);
  const excessDays = q === null ? 0 : Math.max(0, before + leaveDays - q) - Math.max(0, before - q);
  const dailyRate = round2(pay / LEAVE_DAY_DIVISOR);
  let deduction = round2((excessDays * pay) / LEAVE_DAY_DIVISOR);
  if (commission !== null) deduction = Math.min(deduction, Math.max(0, pay + (Number(commission) || 0)));
  return { leaveDays, usedBefore: before, quota: q, excessDays, dailyRate, deduction };
}

// วันลาทั้งปี YYYY แยกรายเดือน → Map(employee_id → number[12])
export async function loadLeaveMonthsByEmployee(db, year) {
  const result = await db.execute({
    sql: `SELECT employee_id, CAST(substr(date, 6, 2) AS INTEGER) AS m, COALESCE(SUM(days), 0) AS total
          FROM employee_leaves WHERE date LIKE ? GROUP BY employee_id, m`,
    args: [`${year}-%`],
  });
  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, Array(12).fill(0));
    const m = Number(row.m);
    if (m >= 1 && m <= 12) map.get(row.employee_id)[m - 1] = Number(row.total) || 0;
  }
  return map;
}

// วันลาเดือนนี้ + สะสมก่อนเดือนนี้ (ปีเดียวกัน) ของพนักงานคนหนึ่ง
export function usageForPeriod(monthsByEmp, employeeId, period) {
  const months = monthsByEmp.get(employeeId) || Array(12).fill(0);
  const idx = Number(period.slice(5, 7)) - 1;
  return {
    days: months[idx] || 0,
    usedBefore: months.slice(0, idx).reduce((s, d) => s + d, 0),
    months,
  };
}

export function rowToLeave(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || '',
    date: row.date,
    days: Number(row.days) || 0,
    leaveType: row.leave_type || 'other',
    isLump: Number(row.is_lump) === 1,
    note: row.note || '',
    recordedBy: row.recorded_by || '',
    createdAt: row.created_at,
  };
}
