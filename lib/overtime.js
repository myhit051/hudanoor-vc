// ค่า OT ของพนักงาน (ตาราง employee_overtime — 1 แถว = 1 วัน, days = 1 หรือ 0.5
// หรือ is_lump = 1: ยอดย้อนหลังทั้งเดือนไม่ระบุวันที่ date = วันที่ 1, 1 แถวต่อคนต่อเดือน)
// ค่า OT = วัน OT ในเดือน × ค่า OT ต่อวัน (ทั้งร้าน app_config.ot_day_rate — ยังไม่ตั้ง = 100)
// บวกเข้ายอดรับในรอบเงินเดือน · รอบเงินเดือนเก็บค่าที่ใช้ไว้ใน payroll_items.ot_days / ot_rate / ot_amount

export const DEFAULT_OT_DAY_RATE = 100;
export const MAX_OT_DAY_RATE = 10000;

const round2 = (n) => Math.round(n * 100) / 100;

// ค่า OT ต่อวัน 0–10,000 บาท — ไม่ถูกต้องคืน null
export function normalizeOtRate(value) {
  const n = Number(value);
  if (value === null || value === '' || !Number.isFinite(n)) return null;
  return n >= 0 && n <= MAX_OT_DAY_RATE ? round2(n) : null;
}

export async function loadOtDayRate(db) {
  const result = await db.execute(`SELECT value FROM app_config WHERE key = 'ot_day_rate'`);
  return normalizeOtRate(result.rows[0]?.value) ?? DEFAULT_OT_DAY_RATE;
}

export function calcOtAmount(days, rate) {
  const d = Number(days) || 0;
  return { days: d, rate, amount: round2(d * rate) };
}

// วัน OT ทั้งปี YYYY แยกรายเดือน → Map(employee_id → number[12])
export async function loadOtMonthsByEmployee(db, year) {
  const result = await db.execute({
    sql: `SELECT employee_id, CAST(substr(date, 6, 2) AS INTEGER) AS m, COALESCE(SUM(days), 0) AS total
          FROM employee_overtime WHERE date LIKE ? GROUP BY employee_id, m`,
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

export function otDaysForPeriod(otMonthsByEmp, employeeId, period) {
  const months = otMonthsByEmp.get(employeeId) || Array(12).fill(0);
  return { days: months[Number(period.slice(5, 7)) - 1] || 0, months };
}

export function rowToOvertime(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    employeeName: row.employee_name || '',
    date: row.date,
    days: Number(row.days) || 0,
    isLump: Number(row.is_lump) === 1,
    note: row.note || '',
    recordedBy: row.recorded_by || '',
    createdAt: row.created_at,
  };
}
