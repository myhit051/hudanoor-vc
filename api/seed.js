import { getTursoClient, initSchema } from '../lib/turso.js';
import crypto from 'crypto';

const hashPin = (pin) => crypto.createHash('sha256').update(String(pin)).digest('hex');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();
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
        created.push(`${u.employee_id} (PIN: ${u.pin})`);
      }
    }

    if (created.length === 0) {
      return res.status(200).json({ success: true, message: 'All default users already exist.' });
    }

    return res.status(200).json({
      success: true,
      message: `Created ${created.length} user(s): ${created.join(', ')}`
    });
  } catch (err) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: err.message });
  }
}
