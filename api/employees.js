import { getTursoClient, initSchema } from '../lib/turso.js';
import { authenticate } from '../lib/auth-middleware.js';

function safeParseJSON(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function rowToEmployee(row) {
  return {
    id: row.id,
    name: row.name || '',
    position: row.position || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    startDate: row.start_date || '',
    salary: Number(row.salary) || 0,
    homeBranch: row.home_branch || '',
    secondaryBranches: safeParseJSON(row.secondary_branches, []),
    branchCommissions: safeParseJSON(row.branch_commissions, []),
    note: row.note || '',
    isActive: Number(row.is_active) === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await initSchema();
    const db = getTursoClient();

    if (req.method === 'GET') {
      const result = await db.execute(
        `SELECT * FROM employees ORDER BY is_active DESC, created_at ASC`
      );
      const employees = result.rows.map(rowToEmployee);
      return res.status(200).json({ data: employees });
    }

    if (req.method === 'POST') {
      const body = req.body?.employee || req.body || {};
      if (!body.name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const authUser = authenticate(req);
      const id = body.id || `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date().toISOString();

      await db.execute({
        sql: `INSERT INTO employees (
          id, name, position, email, phone, address, start_date, salary,
          home_branch, secondary_branches, branch_commissions, note, is_active,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          body.name,
          body.position || '',
          body.email || '',
          body.phone || '',
          body.address || '',
          body.startDate || body.hireDate || now.split('T')[0],
          Number(body.salary) || 0,
          body.homeBranch || '',
          JSON.stringify(Array.isArray(body.secondaryBranches) ? body.secondaryBranches : []),
          JSON.stringify(Array.isArray(body.branchCommissions) ? body.branchCommissions : []),
          body.note || '',
          (body.isActive === false || body.status === 'inactive') ? 0 : 1,
          now,
          now,
        ],
      });

      return res.status(200).json({ success: true, employeeId: id, createdBy: authUser?.name || '' });
    }

    if (req.method === 'PUT') {
      const { employeeId, updates } = req.body || {};
      if (!employeeId || !updates) {
        return res.status(400).json({ error: 'employeeId and updates are required' });
      }

      const existing = await db.execute({
        sql: 'SELECT id FROM employees WHERE id = ?',
        args: [employeeId],
      });
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Employee not found' });
      }

      const sets = [];
      const args = [];
      const map = {
        name: 'name',
        position: 'position',
        email: 'email',
        phone: 'phone',
        address: 'address',
        startDate: 'start_date',
        salary: 'salary',
        homeBranch: 'home_branch',
        note: 'note',
      };
      for (const [k, col] of Object.entries(map)) {
        if (updates[k] !== undefined) {
          sets.push(`${col} = ?`);
          args.push(k === 'salary' ? Number(updates[k]) || 0 : (updates[k] ?? ''));
        }
      }
      if (updates.secondaryBranches !== undefined) {
        sets.push('secondary_branches = ?');
        args.push(JSON.stringify(Array.isArray(updates.secondaryBranches) ? updates.secondaryBranches : []));
      }
      if (updates.branchCommissions !== undefined) {
        sets.push('branch_commissions = ?');
        args.push(JSON.stringify(Array.isArray(updates.branchCommissions) ? updates.branchCommissions : []));
      }
      if (updates.isActive !== undefined) {
        sets.push('is_active = ?');
        args.push(updates.isActive ? 1 : 0);
      } else if (updates.status !== undefined) {
        sets.push('is_active = ?');
        args.push(updates.status === 'active' ? 1 : 0);
      }

      sets.push('updated_at = ?');
      args.push(new Date().toISOString());
      args.push(employeeId);

      if (sets.length === 1) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      await db.execute({
        sql: `UPDATE employees SET ${sets.join(', ')} WHERE id = ?`,
        args,
      });

      return res.status(200).json({ success: true, employeeId });
    }

    if (req.method === 'DELETE') {
      const { employeeId } = req.query;
      if (!employeeId) {
        return res.status(400).json({ error: 'employeeId is required' });
      }

      await db.execute({
        sql: 'DELETE FROM employees WHERE id = ?',
        args: [employeeId],
      });

      return res.status(200).json({ success: true, employeeId });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Employees API error:', error);
    return res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
}
