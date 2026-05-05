import { createClient } from '@libsql/client';

let client = null;
let schemaInitialized = false;

export function getTursoClient() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url || !authToken) {
      throw new Error('Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN environment variables');
    }

    client = createClient({ url, authToken });
  }
  return client;
}

export async function initSchema() {
  if (schemaInitialized) return;
  const db = getTursoClient();
  
  // 1. Create tables (without new columns — safe for existing DBs)
  await db.batch([
    `CREATE TABLE IF NOT EXISTS stock_in (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      cost_price REAL NOT NULL DEFAULT 0,
      sell_price REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sales_orders (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT '',
      branch_or_platform TEXT NOT NULL DEFAULT '',
      sku TEXT NOT NULL,
      product_name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '',
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL DEFAULT 0,
      discount_type TEXT NOT NULL DEFAULT 'amount',
      discount_value REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      final_unit_price REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      stock_in_id TEXT,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'employee',
      allowed_menus TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      position TEXT NOT NULL DEFAULT '',
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      address TEXT DEFAULT '',
      start_date TEXT NOT NULL,
      salary REAL NOT NULL DEFAULT 0,
      home_branch TEXT DEFAULT '',
      secondary_branches TEXT NOT NULL DEFAULT '[]',
      branch_commissions TEXT NOT NULL DEFAULT '[]',
      note TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payroll_runs (
      id TEXT PRIMARY KEY,
      period TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'draft',
      total_salary REAL NOT NULL DEFAULT 0,
      total_commission REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      employee_count INTEGER NOT NULL DEFAULT 0,
      note TEXT DEFAULT '',
      created_by TEXT DEFAULT '',
      finalized_at TEXT DEFAULT '',
      finalized_by TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS payroll_items (
      id TEXT PRIMARY KEY,
      payroll_run_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      position TEXT DEFAULT '',
      home_branch TEXT DEFAULT '',
      salary REAL NOT NULL DEFAULT 0,
      total_commission REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      commission_breakdown TEXT NOT NULL DEFAULT '[]',
      adjustment REAL NOT NULL DEFAULT 0,
      adjustment_note TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      paid_at TEXT DEFAULT '',
      paid_by TEXT DEFAULT '',
      paid_method TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (payroll_run_id) REFERENCES payroll_runs(id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_stock_in_sku_color_size ON stock_in (sku, color, size)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_orders_sku_color_size ON sales_orders (sku, color, size)`,
    `CREATE INDEX IF NOT EXISTS idx_sales_orders_stock_in_id ON sales_orders (stock_in_id)`,
    `CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users (employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_employees_is_active ON employees (is_active)`,
    `CREATE INDEX IF NOT EXISTS idx_payroll_items_run_id ON payroll_items (payroll_run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON payroll_items (employee_id)`,
    `CREATE INDEX IF NOT EXISTS idx_payroll_runs_period ON payroll_runs (period)`
  ], 'deferred');

  // 2. Safe migrations — add new columns to existing tables
  const migrations = [
    `ALTER TABLE stock_in ADD COLUMN recorded_by TEXT DEFAULT ''`,
    `ALTER TABLE sales_orders ADD COLUMN recorded_by TEXT DEFAULT ''`,
    `ALTER TABLE sales_orders ADD COLUMN order_id TEXT DEFAULT ''`
  ];

  for (const query of migrations) {
    try {
      await db.execute(query);
    } catch (e) {
      // Ignore "duplicate column" errors — means column already exists
    }
  }

  // 3. Create indexes on new columns (after migrations added them)
  try {
    await db.execute(`CREATE INDEX IF NOT EXISTS idx_sales_orders_order_id ON sales_orders (order_id)`);
  } catch (e) {
    // Ignore if already exists
  }

  // 4. Data migration: set existing empty recorded_by to 'husna'
  try {
    await db.execute(`UPDATE sales_orders SET recorded_by = 'husna' WHERE recorded_by = '' OR recorded_by IS NULL`);
    await db.execute(`UPDATE stock_in SET recorded_by = 'husna' WHERE recorded_by = '' OR recorded_by IS NULL`);
  } catch (e) {
    // Ignore errors
  }

  schemaInitialized = true;
}

