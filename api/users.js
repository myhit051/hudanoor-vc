import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate, requireAdmin } from '../lib/auth-middleware.js';
import { hashPin } from './auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Validate authentication and admin role
  const authUser = authenticate(req);
  if (!authUser) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!requireAdmin(authUser)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  try {
    await initSchema();
    const db = getTursoClient();

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

      // Check if employee_id already exists
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
      args.push(id); // for WHERE clause

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
  } catch (error) {
    console.error('Users API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
