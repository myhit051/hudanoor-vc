import { createClient } from '@libsql/client';

let client = null;

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

export async function initSalesSchema() {
  const db = getTursoClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sales_orders (
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
    )
  `);
}

export async function initStockSchema() {
  const db = getTursoClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS stock_in (
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
    )
  `);
}
