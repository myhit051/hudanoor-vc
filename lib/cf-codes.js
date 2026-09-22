// รหัส CF สำหรับส่งออกไประบบ HUDANOOR Live CF (ลูกค้าพิมพ์ "CF A0801" ในไลฟ์)
// ระบบไลฟ์อ่านได้เฉพาะ ตัวอักษร 1–4 ตัว + ตัวเลข 1–4 ตัว และ 1 รหัส = 1 ตัวเลือก (SKU + สี + ไซส์)
// รหัสที่ตั้งแล้วเก็บถาวรในตาราง cf_codes — ส่งออกกี่ครั้งก็ได้รหัสเดิม (ระบบไลฟ์ใช้รหัสจับคู่สินค้า)

export const CF_CODE_RE = /^[A-Z]{1,4}\d{1,4}$/;

export const normalizeCfCode = (code) => String(code || '').trim().toUpperCase();

const variantKey = (v) => `${v.sku}\u0000${v.color}\u0000${v.size}`;

/**
 * รหัสใหม่ให้ตัวเลือกของ SKU เดียว: SKU ที่เข้ารูปแบบ → ต่อท้ายเลขลำดับ (A08 → A0801, A0802 …)
 * SKU ที่ใช้ไม่ได้ (เช่น "no") หรือเลขยาวจนต่อไม่ได้ → Z001, Z002 …
 */
function nextCode(sku, taken) {
  const base = String(sku || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = base.match(/^([A-Z]{1,4})(\d{0,3})$/);
  if (m) {
    const room = 4 - m[2].length; // จำนวนหลักที่เหลือให้ต่อท้าย
    const width = Math.min(2, room);
    const max = 10 ** width - 1;
    for (let i = 1; i <= max; i++) {
      const code = `${m[1]}${m[2]}${String(i).padStart(width, '0')}`;
      if (!taken.has(code)) return code;
    }
  }
  for (let i = 1; i <= 9999; i++) {
    const code = `Z${String(i).padStart(3, '0')}`;
    if (!taken.has(code)) return code;
  }
  throw new Error('รหัส CF เต็ม');
}

/**
 * รายการตัวเลือกทั้งหมด (รวมที่ขายหมดแล้ว) พร้อมคงเหลือ ราคาล็อตล่าสุด และรหัส CF
 * ตัวเลือกที่ยังไม่มีรหัส จะตั้งให้อัตโนมัติและบันทึกไว้เลย
 */
export async function listCfVariants(db, recordedBy = '') {
  const [lotsRes, soldRes, codesRes] = await Promise.all([
    db.execute(`SELECT sku, COALESCE(color, '') AS color, COALESCE(size, '') AS size, product_name,
                       quantity, sell_price, created_at
                FROM stock_in ORDER BY created_at ASC`),
    db.execute(`SELECT sku, COALESCE(color, '') AS color, COALESCE(size, '') AS size, SUM(quantity) AS sold
                FROM sales_orders GROUP BY sku, COALESCE(color, ''), COALESCE(size, '')`),
    db.execute('SELECT sku, color, size, cf_code FROM cf_codes'),
  ]);

  // รวมล็อตเป็นตัวเลือก — ราคาเอาจากล็อตที่รับเข้าล่าสุด
  // ชื่อสินค้าใช้ชื่อจากล็อตแรกของ SKU ทุกตัวเลือก (ระบบไลฟ์จัดกลุ่มตามชื่อ และไม่ย้ายกลุ่มถ้าชื่อเปลี่ยน)
  const variants = new Map();
  const skuName = new Map();
  for (const r of lotsRes.rows) {
    if (!skuName.has(r.sku)) skuName.set(r.sku, r.product_name);
    const key = variantKey(r);
    const v = variants.get(key) || { sku: r.sku, color: r.color, size: r.size, total_in: 0, first_at: r.created_at };
    v.total_in += Number(r.quantity) || 0;
    v.product_name = skuName.get(r.sku);
    v.price = Number(r.sell_price) || 0;
    variants.set(key, v);
  }
  const sold = new Map(soldRes.rows.map((r) => [variantKey(r), Number(r.sold) || 0]));
  const codes = new Map(codesRes.rows.map((r) => [variantKey(r), r.cf_code]));
  const taken = new Set(codesRes.rows.map((r) => r.cf_code));

  // ตั้งรหัสให้ตัวที่ยังไม่มี — เรียงตาม SKU แล้วตามวันที่รับเข้าครั้งแรก (สีที่มาก่อนได้เลขน้อยกว่า)
  const missing = [...variants.values()]
    .filter((v) => !codes.has(variantKey(v)))
    .sort((a, b) => a.sku.localeCompare(b.sku) || String(a.first_at).localeCompare(String(b.first_at)));
  if (missing.length > 0) {
    const now = new Date().toISOString();
    const ops = [];
    for (const v of missing) {
      const code = nextCode(v.sku, taken);
      taken.add(code);
      codes.set(variantKey(v), code);
      ops.push({
        sql: `INSERT OR IGNORE INTO cf_codes (sku, color, size, cf_code, auto, updated_by, created_at, updated_at)
              VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
        args: [v.sku, v.color, v.size, code, recordedBy, now, now],
      });
    }
    await db.batch(ops, 'write');
    // มีคนตั้งพร้อมกัน (OR IGNORE) → อ่านของจริงจากตารางอีกรอบ
    const fresh = await db.execute('SELECT sku, color, size, cf_code FROM cf_codes');
    codes.clear();
    for (const r of fresh.rows) codes.set(variantKey(r), r.cf_code);
  }

  return [...variants.values()]
    .map((v) => ({
      sku: v.sku,
      color: v.color,
      size: v.size,
      product_name: v.product_name,
      price: v.price,
      total_in: v.total_in,
      sold: sold.get(variantKey(v)) || 0,
      stock: Math.max(0, v.total_in - (sold.get(variantKey(v)) || 0)),
      cf_code: codes.get(variantKey(v)) || '',
    }))
    .sort((a, b) => a.cf_code.localeCompare(b.cf_code));
}
