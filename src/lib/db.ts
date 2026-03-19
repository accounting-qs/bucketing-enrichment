import { Pool, PoolClient } from "pg";

// PostgreSQL-only — no more SQLite
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn(
    ">>> WARNING: DATABASE_URL is not set. Database operations will fail."
  );
}

// Enable SSL for any external DB (Render, Supabase, etc.)
const needsSSL = DATABASE_URL
  ? !DATABASE_URL.includes("localhost") && !DATABASE_URL.includes("127.0.0.1")
  : false;

const pool = new Pool({
  connectionString: DATABASE_URL || "postgresql://localhost/quantum_enricher",
  ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error(">>> Unexpected PG pool error:", err);
});

// Inline schema SQL — avoids fs.readFileSync in Next.js production bundles
const SCHEMA_SQL = `
-- Drop old incompatible tables (one-time migration from v1 → v2)
DROP TABLE IF EXISTS analysis_rows CASCADE;
DROP TABLE IF EXISTS analyses CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS workbooks CASCADE;
DROP TABLE IF EXISTS custom_buckets CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  display_name TEXT,
  storage_key TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  row_count INTEGER NOT NULL DEFAULT 0,
  file_size_bytes BIGINT DEFAULT 0,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS custom_buckets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_name TEXT NOT NULL UNIQUE,
  description TEXT,
  direct_ancestor TEXT,
  root_category TEXT,
  include_terms JSONB DEFAULT '[]',
  exclude_terms JSONB DEFAULT '[]',
  example_strings JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  workbook_id UUID NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
  selected_column TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  ai_model TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  total_rows INTEGER DEFAULT 0,
  total_rows_processed INTEGER DEFAULT 0,
  exact_matches INTEGER DEFAULT 0,
  inclusive_matches INTEGER DEFAULT 0,
  ai_classified INTEGER DEFAULT 0,
  general_bucket_count INTEGER DEFAULT 0,
  token_usage JSONB DEFAULT '{}',
  bucket_distribution JSONB DEFAULT '{}',
  low_confidence_items JSONB DEFAULT '[]',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_rows (
  id BIGSERIAL PRIMARY KEY,
  analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  row_index INTEGER NOT NULL,
  original_value TEXT,
  all_columns JSONB NOT NULL DEFAULT '{}',
  industry TEXT NOT NULL DEFAULT 'General Industry',
  bucket_name TEXT NOT NULL DEFAULT 'General Industry',
  root_category TEXT,
  direct_ancestor TEXT,
  confidence REAL,
  reason TEXT,
  is_generic BOOLEAN NOT NULL DEFAULT FALSE,
  is_disqualified BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  result_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workbooks_project ON workbooks(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_workbook ON analyses(workbook_id);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_analysis ON analysis_rows(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_bucket ON analysis_rows(analysis_id, bucket_name);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_industry ON analysis_rows(analysis_id, industry);
CREATE INDEX IF NOT EXISTS idx_jobs_analysis ON jobs(analysis_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
`;

let migrationDone = false;

/**
 * Run the schema migration (lazy, only on first DB call)
 * Uses a dedicated client with transaction for multi-statement DDL
 */
export async function ensureMigrations(): Promise<void> {
  if (migrationDone) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(SCHEMA_SQL);
    await client.query("COMMIT");
    migrationDone = true;
    console.log(">>> Database migration successful");
  } catch (err: unknown) {
    await client.query("ROLLBACK").catch(() => {});
    const message = err instanceof Error ? err.message : String(err);
    console.error(">>> Database migration error:", message);
    // Don't mark as done — retry next time, but don't block the request
    // The actual query will fail with a more descriptive error
  } finally {
    client.release();
  }
}

/**
 * Execute a parameterized SQL query
 * Uses $1, $2, ... parameter syntax (PostgreSQL native)
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  await ensureMigrations();
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
  await ensureMigrations();
  const result = await pool.query(sql, params);
  return result.rowCount || 0;
}

/**
 * Run multiple queries inside a transaction
 */
export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  await ensureMigrations();
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
  await ensureMigrations();

  const colCount = columns.length;
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
