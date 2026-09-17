# วิธีทดสอบโดยไม่แตะข้อมูลจริง

## 1) ทดสอบ API กับ SQLite จำลอง
`@libsql/client` รองรับ `file:` จึงเรียก handler ตรง ๆ ได้ (ใช้ `initSchema()` สร้างตารางให้)

```js
// /tmp/apitest.mjs  →  rm -f /tmp/apitest.db && node /tmp/apitest.mjs
process.env.TURSO_DATABASE_URL = 'file:/tmp/apitest.db';
process.env.TURSO_AUTH_TOKEN = 'x';
const { default: handler } = await import('/root/projects/hudanoor-vc/api/sales.js');
const { getTursoClient, initSchema } = await import('/root/projects/hudanoor-vc/lib/turso.js');
const { signToken } = await import('/root/projects/hudanoor-vc/lib/jwt.js');
const token = signToken({ id: '1', name: 'boss', role: 'admin' });   // role อื่นเช่น 'staff'
const call = (method, { body, query = {}, auth = true } = {}) => new Promise((resolve) => {
  const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; },
    json(d) { resolve({ code: this.code, d }); }, end() { resolve({ code: this.code }); } };
  handler({ method, body, query, headers: auth ? { authorization: `Bearer ${token}` } : {} }, res);
});
await initSchema();
const db = getTursoClient();
const now = new Date().toISOString();
await db.execute({ sql: `INSERT INTO stock_in (id,date,sku,product_name,quantity,cost_price,sell_price,created_at,updated_at)
  VALUES ('st1','2026-09-01','S1','เสื้อ',100,100,300,?,?)`, args: [now, now] });
// บัญชีพนักงาน (ใช้ทดสอบผู้บันทึก): employees ต้องมี name, position, start_date, salary,
// secondary_branches='[]', branch_commissions='{}', is_active, created_at, updated_at, account_active, account_name
console.log(await call('POST', { body: [{ date: '2026-09-17', channel: 'online', branch_or_platform: 'FB',
  sku: 'S1', product_name: 'เสื้อ', quantity: 1, unit_price: 300, stock_in_id: 'st1', shipping_fee: 40, payment_method: 'cod' }] }));
```
- POST ต้องมี `stock_in` ที่มีของพอ ไม่งั้นได้ 400 สต๊อกไม่พอ
- เคสที่ควรเช็คเสมอเมื่อแตะ `api/sales.js`: ไม่ล็อกอิน→401, เลขออเดอร์ไม่ซ้ำหลังลบ+บันทึกพร้อมกัน, ค่าส่งนับครั้งเดียว, COD เฉพาะออนไลน์, ผู้บันทึก (admin/staff)

## 2) ทดสอบหน้าเว็บด้วย Playwright + API ปลอม
- Playwright MCP ใช้ไม่ได้ (root/sandbox) → ใช้ playwright-core จาก npx cache:
  `find / -path /proc -prune -o -type d -name playwright-core -print 2>/dev/null` (เคยอยู่ที่ `/root/.npm/_npx/*/node_modules/playwright-core`)
- เบราว์เซอร์: `/opt/google/chrome/chrome` + `args: ['--no-sandbox']`
- ขั้นตอน:
  1. `CAP_MEM=2G capped npm run build`
  2. รัน `npx vite preview --host 127.0.0.1 --port 4179 --strictPort` แบบ background (ห้ามใช้ `localhost`)
  3. `ctx.route('**/api/**', ...)` ตอบปลอม:
     - `/api/auth` → `{ user: { id, name, role: 'admin'|'staff', allowedMenus: [...] } }`
     - `/api/auth?action=user-names` → `{ data: [{id, name}] }`
     - `/api/stock` → `{ data: [{ id, sku, product_name, color, size, sell_price, available_quantity, ... }] }`
     - `/api/sales` GET → `{ data: [แถว sales_orders] }` · POST → เก็บ `req.postDataJSON()` ไว้ตรวจ
     - `/api/settings` → `{ data: [['Key','Value','Description'], ['storeName', JSON.stringify('HUDANOOR'), ''], ...] }`
  4. `page.goto('/login')` → `localStorage.setItem('token','test')` → ไปหน้าที่จะทดสอบ
  5. ดาวน์โหลด PDF ด้วย `page.waitForEvent('download')` แล้วดูผลด้วย `pdfinfo` / `pdftoppm -r 80 -png x.pdf out` และเปิดภาพดู
  6. เสร็จแล้ว `fuser -k 4179/tcp`
- ตัวเลือกที่ใช้บ่อย: combobox ลำดับที่ 0 = ผู้บันทึก (เฉพาะ admin) แล้วต่อด้วย ช่องทาง, สาขา · `#shipping_fee`, `#shipping_address`, `#is_cod`, `#recorder`, `#quantity`, `#note`
