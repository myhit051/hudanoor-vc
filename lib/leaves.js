// การลาของพนักงาน (ตาราง employee_leaves — 1 แถว = 1 วัน, days = 1 หรือ 0.5
// หรือ is_lump = 1: ยอดย้อนหลังทั้งเดือนไม่ระบุวันที่ date = วันที่ 1, days ได้ถึง 31)
// ลาสะสมในปีปฏิทินเกินวันที่ได้ต่อปี (employees.leave_quota_yearly) ถูกหักวันละ เงินเดือน ÷ 25
// — หักในเดือนที่ลาเกิน (เดือนก่อน ๆ ที่หักไปแล้วไม่หักซ้ำ)
// หักจากคอมก่อน ส่วนที่คอมไม่พอหักจากเงินเดือนต่อ — ยอดรับไม่ติดลบ
// สัญญาจ้าง (2 ต.ค. 2026):
// - หยุดรายอ (leave_type 'raya') ไม่นับเป็นวันลา ปีละไม่เกิน RAYA_DAYS_PER_YEAR วัน — ส่วนที่เกินนับเป็นวันลาปกติ
// - ลาในเดือนเกิน employees.commission_leave_limit วัน → ตัดคอมเดือนนั้นทั้งหมด (NULL = ไม่ตัด)

export const LEAVE_DAY_DIVISOR = 25;
export const LEAVE_TYPES = ['sick', 'personal', 'other', 'raya'];
export const RAYA_DAYS_PER_YEAR = 3;
export const MAX_LEAVE_RANGE_DAYS = 31;
export const MAX_YEARLY_QUOTA = 366;
export const MAX_COMMISSION_LEAVE_LIMIT = 31;

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

// ลาในเดือน (days) เกินเกณฑ์ (limit) → ตัดคอมเดือนนั้นทั้งหมด · limit null = ไม่ตัด
export function calcCommissionForfeit({ commission, limit, days }) {
  const l = normalizeQuota(limit);
  const forfeited = l !== null && (Number(days) || 0) > l ? Math.max(0, Number(commission) || 0) : 0;
  return { limit: l, forfeited };
}

// วันลาทั้งปี YYYY แยกรายเดือน → Map(employee_id → { months: number[12], rayaMonths: number[12] })
// months = วันลาที่นับ (รวมหยุดรายอส่วนที่เกินโควตารายอของปี) · rayaMonths = หยุดรายอทั้งหมด
export async function loadLeaveMonthsByEmployee(db, year) {
  const result = await db.execute({
    sql: `SELECT employee_id, CAST(substr(date, 6, 2) AS INTEGER) AS m,
            COALESCE(SUM(CASE WHEN leave_type = 'raya' THEN 0 ELSE days END), 0) AS normal,
            COALESCE(SUM(CASE WHEN leave_type = 'raya' THEN days ELSE 0 END), 0) AS raya
          FROM employee_leaves WHERE date LIKE ? GROUP BY employee_id, m`,
    args: [`${year}-%`],
  });
  const raw = new Map();
  for (const row of result.rows) {
    if (!raw.has(row.employee_id)) raw.set(row.employee_id, { normal: Array(12).fill(0), raya: Array(12).fill(0) });
    const m = Number(row.m);
    if (m < 1 || m > 12) continue;
    raw.get(row.employee_id).normal[m - 1] = Number(row.normal) || 0;
    raw.get(row.employee_id).raya[m - 1] = Number(row.raya) || 0;
  }
  const map = new Map();
  for (const [empId, { normal, raya }] of raw) {
    // หยุดรายอใช้สิทธิ์ตามลำดับเดือน — เกินสิทธิ์ของปีแล้วนับเป็นวันลาในเดือนนั้น
    let rayaUsed = 0;
    const months = normal.map((d, i) => {
      const free = Math.max(0, RAYA_DAYS_PER_YEAR - rayaUsed);
      rayaUsed += raya[i];
      return d + Math.max(0, raya[i] - free);
    });
    map.set(empId, { months, rayaMonths: raya });
  }
  return map;
}

// วันลาเดือนนี้ + สะสมก่อนเดือนนี้ (ปีเดียวกัน) ของพนักงานคนหนึ่ง
export function usageForPeriod(monthsByEmp, employeeId, period) {
  const entry = monthsByEmp.get(employeeId);
  const months = entry?.months || Array(12).fill(0);
  const rayaMonths = entry?.rayaMonths || Array(12).fill(0);
  const idx = Number(period.slice(5, 7)) - 1;
  return {
    days: months[idx] || 0,
    usedBefore: months.slice(0, idx).reduce((s, d) => s + d, 0),
    months,
    rayaMonths,
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
