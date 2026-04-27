import { getTursoClient, initSchema } from '../lib/turso.js';
import crypto from 'crypto';
import { signToken, verifyToken } from '../lib/jwt.js';

export function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    // POST /api/auth — Login
    if (req.method === 'POST') {
      const { employee_id, pin } = req.body;
      if (!employee_id || !pin) {
        return res.status(400).json({ error: 'กรุณากรอกรหัสพนักงานและ PIN' });
      }

      const result = await db.execute({
        sql: 'SELECT * FROM users WHERE employee_id = ? AND is_active = 1',
        args: [employee_id]
      });

      if (result.rows.length === 0) {
        return res.status(401).json({ error: 'ไม่พบผู้ใช้งานหรือบัญชีถูกระงับ' });
      }

      const user = result.rows[0];
      const pinHash = hashPin(pin);

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

    // GET /api/auth — Verify token
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
