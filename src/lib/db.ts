import { Pool, PoolClient } from "pg";
import fs from "fs";
import path from "path";

// PostgreSQL-only — no more SQLite
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    ">>> WARNING: DATABASE_URL is not set. Database operations will fail."
  );
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error(">>> Unexpected PG pool error:", err);
});

/**
 * Run the schema migration on startup
 */
export async function runMigrations(): Promise<void> {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    let schemaSql: string;

    try {
      schemaSql = fs.readFileSync(schemaPath, "utf-8");
    } catch {
      // In production builds, __dirname may differ. Try process.cwd()
      const altPath = path.join(process.cwd(), "src", "lib", "schema.sql");
      schemaSql = fs.readFileSync(altPath, "utf-8");
    }

    await pool.query(schemaSql);
    console.log(">>> Database migration successful");
  } catch (err) {
    console.error(">>> Database migration error:", err);
  }
}

// Auto-run migrations on module load
runMigrations();

/**
 * Execute a parameterized SQL query
 * Uses $1, $2, ... parameter syntax (PostgreSQL native)
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/**
 * Get a single record, or null if not found
 */
export async function getOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}

/**
 * Execute an INSERT/UPDATE/DELETE and return affected row count
 */
export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<number> {
  const result = await pool.query(sql, params);
  return result.rowCount || 0;
}

/**
 * Run multiple queries inside a transaction
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Batch insert rows efficiently using a single multi-row INSERT
 */
export async function batchInsert(
  tableName: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) return;

  // Build parameterized values: ($1,$2,$3), ($4,$5,$6), ...
  const colCount = columns.length;
  const valueClauses: string[] = [];
  const allParams: unknown[] = [];

  // Insert in chunks of 500 rows to avoid parameter limit (65535)
  const chunkSize = Math.floor(65535 / colCount);
  const safeChunkSize = Math.min(chunkSize, 500);

  for (let c = 0; c < rows.length; c += safeChunkSize) {
    const chunk = rows.slice(c, c + safeChunkSize);
    const chunkValueClauses: string[] = [];
    const chunkParams: unknown[] = [];

    for (let i = 0; i < chunk.length; i++) {
      const row = chunk[i];
      const placeholders = row.map(
        (_, j) => `$${i * colCount + j + 1}`
      );
      chunkValueClauses.push(`(${placeholders.join(",")})`);
      chunkParams.push(...row);
    }

    const sql = `INSERT INTO ${tableName} (${columns.join(",")}) VALUES ${chunkValueClauses.join(",")}`;
    await pool.query(sql, chunkParams);
  }
}

export default { query, getOne, execute, transaction, batchInsert };
