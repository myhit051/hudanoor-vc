import { getTursoClient, initSchema } from '../lib/turso.js';
import crypto from 'crypto';
import { signToken, verifyToken } from '../lib/jwt.js';
import { authenticate, requireAdmin } from '../lib/auth-middleware.js';

export function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

// ─── Default users for seed ───
const DEFAULT_USERS = [
  {
    employee_id: 'admin',
    name: 'ผู้ดูแลระบบ',
    pin: '123456',
    role: 'admin',
    allowed_menus: '[]'
  },
  {
    employee_id: 'nurunhuda',
    name: 'nurunhuda',
    pin: 'hdn2026',
    role: 'employee',
    allowed_menus: JSON.stringify([
      'dashboard', 'add-record', 'stock-receiving', 'sales-entry',
      'stock-inventory', 'task-reminder', 'employees', 'settings'
    ])
  }
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || '';

  try {
    await initSchema();
    const db = getTursoClient();


    // ═══════════════════════════════════════
    // ACTION: seed — สร้างผู้ใช้เริ่มต้น
    // GET /api/auth?action=seed
    // ═══════════════════════════════════════
    if (action === 'seed') {
      const now = new Date().toISOString();
      const created = [];

      for (const u of DEFAULT_USERS) {
        const check = await db.execute({
          sql: 'SELECT id FROM users WHERE employee_id = ?',
          args: [u.employee_id]
        });

        if (check.rows.length === 0) {
          const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          await db.execute({
            sql: `INSERT INTO users (id, employee_id, name, pin_hash, role, allowed_menus, is_active, created_at, updated_at) 
                  VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
            args: [id, u.employee_id, u.name, hashPin(u.pin), u.role, u.allowed_menus, now, now]
          });
          created.push(`${u.employee_id}`);
        }
      }

      if (created.length === 0) {
        return res.status(200).json({ success: true, message: 'ผู้ใช้เริ่มต้นมีอยู่แล้ว' });
      }
      return res.status(200).json({
        success: true,
        message: `สร้างผู้ใช้เริ่มต้น ${created.length} คน: ${created.join(', ')}`
      });
    }

    // ═══════════════════════════════════════
    // ACTION: user-names — รายชื่อบัญชีผู้ใช้งานที่ active (ผู้ล็อกอินทุกคนเรียกได้)
    // GET /api/auth?action=user-names — ใช้เป็นตัวเลือก "ผู้บันทึก" ในหน้าประวัติการขาย
    // คืนเฉพาะ id + name (ไม่เปิดเผย role/menus/pin); ชื่อผู้บันทึกแสดงอยู่ในหน้านั้นอยู่แล้ว
    // ═══════════════════════════════════════
    if (action === 'user-names') {
      const authUser = authenticate(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
      }
      // แหล่งเดียว: บัญชีล็อกอินที่ผูกกับพนักงาน (employees.account_active = 1)
      // คืน account_name เป็น "name" เพื่อให้ตรงกับค่า recorded_by ที่ใช้คิดคอมเหมือนเดิมเป๊ะ
      const result = await db.execute(
        `SELECT id, account_name AS name FROM employees WHERE account_active = 1 AND account_name != '' ORDER BY account_name`
      );
      return res.status(200).json({ data: result.rows });
    }

    // ═══════════════════════════════════════
    // ACTION: accounts — จัดการบัญชีล็อกอินบนตาราง employees (Admin only)
    // GET  /api/auth?action=accounts            → รายชื่อพนักงาน + สถานะบัญชี (ไม่คืน pin)
    // PUT  /api/auth?action=accounts            → ตั้ง/แก้บัญชีของพนักงานหนึ่งคน
    //   body: { employeeId, login_username?, pin?, role?, allowed_menus?, account_active? }
    // ═══════════════════════════════════════
    if (action === 'accounts') {
      const authUser = authenticate(req);
      if (!authUser) return res.status(401).json({ error: 'Unauthorized' });
      if (!requireAdmin(authUser)) return res.status(403).json({ error: 'Forbidden: Admin access required' });

      if (req.method === 'GET') {
        const result = await db.execute(
          `SELECT id, name, position, is_active, login_username, account_name, role, allowed_menus, account_active,
                  (CASE WHEN pin_hash IS NOT NULL AND pin_hash != '' THEN 1 ELSE 0 END) AS has_pin
           FROM employees ORDER BY is_active DESC, name`
        );
        const data = result.rows.map(r => ({
          ...r,
          allowed_menus: JSON.parse(r.allowed_menus || '[]'),
          has_account: !!(r.login_username && r.login_username !== ''),
        }));
        return res.status(200).json({ data });
      }

      if (req.method === 'PUT') {
        const { employeeId, login_username, pin, role, allowed_menus, account_active } = req.body || {};
        if (!employeeId) return res.status(400).json({ error: 'ต้องระบุ employeeId' });

        const empRes = await db.execute({ sql: 'SELECT * FROM employees WHERE id = ?', args: [employeeId] });
        if (empRes.rows.length === 0) return res.status(404).json({ error: 'ไม่พบพนักงาน' });
        const emp = empRes.rows[0];

        const sets = [];
        const args = [];

        if (login_username !== undefined) {
          const uname = String(login_username).trim();
          if (uname !== '') {
            // กันชื่อล็อกอินซ้ำกับพนักงานคนอื่น
            const dup = await db.execute({
              sql: 'SELECT id FROM employees WHERE login_username = ? AND id != ?',
              args: [uname, employeeId],
            });
            if (dup.rows.length > 0) return res.status(400).json({ error: 'ชื่อผู้ใช้นี้ถูกใช้แล้ว' });
          }
          sets.push('login_username = ?'); args.push(uname);
          // ตั้ง account_name อัตโนมัติถ้ายังว่าง (เพื่อใช้เป็น recorded_by)
          if ((!emp.account_name || emp.account_name === '') && uname !== '') {
            sets.push('account_name = ?'); args.push(uname);
          }
        }
        if (pin !== undefined && pin !== '') { sets.push('pin_hash = ?'); args.push(hashPin(pin)); }
        if (role !== undefined) { sets.push('role = ?'); args.push(role || 'employee'); }
        if (allowed_menus !== undefined) { sets.push('allowed_menus = ?'); args.push(JSON.stringify(allowed_menus || [])); }
        if (account_active !== undefined) { sets.push('account_active = ?'); args.push(account_active ? 1 : 0); }

        if (sets.length === 0) return res.status(400).json({ error: 'ไม่มีข้อมูลให้แก้ไข' });

        sets.push('updated_at = ?'); args.push(new Date().toISOString());
        args.push(employeeId);
        await db.execute({ sql: `UPDATE employees SET ${sets.join(', ')} WHERE id = ?`, args });
        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ═══════════════════════════════════════
    // ACTION: users — จัดการผู้ใช้ (Admin only)
    // GET/POST/PUT/DELETE /api/auth?action=users
    // ═══════════════════════════════════════
    if (action === 'users') {
      const authUser = authenticate(req);
      if (!authUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!requireAdmin(authUser)) {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
      }

      // GET: List users
      if (req.method === 'GET') {
        const result = await db.execute('SELECT id, employee_id, name, role, allowed_menus, is_active, created_at, updated_at FROM users');
        const users = result.rows.map(r => ({
          ...r,
          allowed_menus: JSON.parse(r.allowed_menus || '[]')
        }));
        return res.status(200).json({ data: users });
      }

      // POST: Create user
      if (req.method === 'POST') {
        const { employee_id, name, pin, role, allowed_menus } = req.body;
        if (!employee_id || !name || !pin) {
          return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
        }

        const existCheck = await db.execute({
          sql: 'SELECT id FROM users WHERE employee_id = ?',
          args: [employee_id]
        });
        if (existCheck.rows.length > 0) {
          return res.status(400).json({ error: 'รหัสพนักงานนี้มีในระบบแล้ว' });
        }

        const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const pinHash = hashPin(pin);
        const menusJson = JSON.stringify(allowed_menus || []);
        const now = new Date().toISOString();

        await db.execute({
          sql: `INSERT INTO users (id, employee_id, name, pin_hash, role, allowed_menus, is_active, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          args: [id, employee_id, name, pinHash, role || 'employee', menusJson, now, now]
        });

        return res.status(201).json({ success: true, id });
      }

      // PUT: Update user
      if (req.method === 'PUT') {
        const { id, pin, role, allowed_menus, is_active } = req.body;
        if (!id) return res.status(400).json({ error: 'Missing user id' });

        const updates = [];
        const args = [];

        if (pin) {
          updates.push('pin_hash = ?');
          args.push(hashPin(pin));
        }
        if (role) {
          updates.push('role = ?');
          args.push(role);
        }
        if (allowed_menus) {
          updates.push('allowed_menus = ?');
          args.push(JSON.stringify(allowed_menus));
        }
        if (is_active !== undefined) {
          updates.push('is_active = ?');
          args.push(is_active ? 1 : 0);
        }

        if (updates.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        updates.push('updated_at = ?');
        args.push(new Date().toISOString());
        args.push(id);

        await db.execute({
          sql: `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
          args
        });

        return res.status(200).json({ success: true });
      }

      // DELETE: Soft delete user
      if (req.method === 'DELETE') {
        const { id } = req.query;
        if (!id) return res.status(400).json({ error: 'Missing user id' });

        await db.execute({
          sql: 'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?',
          args: [new Date().toISOString(), id]
        });

        return res.status(200).json({ success: true });
      }

      return res.status(405).json({ error: 'Method not allowed' });
    }

    // ═══════════════════════════════════════
    // DEFAULT: Login & Verify (no action param)
    // POST /api/auth — Login
    // GET  /api/auth — Verify token
    // ═══════════════════════════════════════

    // POST: Login
    if (req.method === 'POST') {
      const { employee_id, pin } = req.body;
      if (!employee_id || !pin) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสพนักงานและ PIN' });
      }

      const pinHash = hashPin(pin);

      // 1) แหล่งหลักใหม่: ตาราง employees ที่มีบัญชีล็อกอิน (account_active = 1)
      //    account_name ถูกใช้เป็น recorded_by/JWT name เพื่อให้ประวัติ+คอมไม่เปลี่ยน
      const empRes = await db.execute({
        sql: 'SELECT * FROM employees WHERE login_username = ? AND account_active = 1',
        args: [employee_id]
      });

      if (empRes.rows.length > 0) {
        const emp = empRes.rows[0];
        if (emp.pin_hash !== pinHash) {
          return res.status(401).json({ error: 'PIN ไม่ถูกต้อง' });
        }
        const payload = {
          userId: emp.id,
          employeeId: emp.login_username,
          name: emp.account_name || emp.name,
          role: emp.role || 'employee',
          allowedMenus: JSON.parse(emp.allowed_menus || '[]')
        };
        return res.status(200).json({ success: true, token: signToken(payload), user: payload });
      }

      // 2) Fallback (กันล็อกเอาต์): ตาราง users เดิม
      const result = await db.execute({
        sql: 'SELECT * FROM users WHERE employee_id = ? AND is_active = 1',
        args: [employee_id]
      });

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'ไม่พบผู้ใช้งานหรือบัญชีถูกระงับ' });
      }

      const user = result.rows[0];

      if (user.pin_hash !== pinHash) {
        return res.status(401).json({ error: 'PIN ไม่ถูกต้อง' });
      }

      const allowedMenus = JSON.parse(user.allowed_menus || '[]');
      const payload = {
        userId: user.id,
        employeeId: user.employee_id,
        name: user.name,
        role: user.role,
        allowedMenus
      };

      const token = signToken(payload);

      return res.status(200).json({
        success: true,
        token,
        user: payload
      });
    }

    // GET: Verify token
    if (req.method === 'GET') {
      const authHeader = req.headers.authorization || '';
      if (!authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      const token = authHeader.split(' ')[1];
      const decoded = verifyToken(token);
      
      if (!decoded) {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      
      return res.status(200).json({ success: true, user: decoded });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
