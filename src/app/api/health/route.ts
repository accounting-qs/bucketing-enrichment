import { NextResponse } from "next/server";
import { Pool } from "pg";

export async function GET() {
  const DATABASE_URL = process.env.DATABASE_URL;
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    has_database_url: !!DATABASE_URL,
    database_url_preview: DATABASE_URL
      ? DATABASE_URL.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")
      : null,
  };

  if (!DATABASE_URL) {
    return NextResponse.json({ ...results, error: "DATABASE_URL not set" });
  }

  // Test raw connection
  const needsSSL =
    !DATABASE_URL.includes("localhost") &&
    !DATABASE_URL.includes("127.0.0.1");

  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: needsSSL ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    // Step 1: basic connection
    const connResult = await pool.query("SELECT NOW() as time, current_database() as db, current_user as user_name");
    results.connection = "OK";
    results.db_time = connResult.rows[0].time;
    results.db_name = connResult.rows[0].db;
    results.db_user = connResult.rows[0].user_name;

    // Step 2: check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    results.existing_tables = tablesResult.rows.map(
      (r: { table_name: string }) => r.table_name
    );

    // Step 3: try creating just the projects table
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      results.create_projects = "OK";
    } catch (createErr: unknown) {
      results.create_projects_error = createErr instanceof Error ? createErr.message : String(createErr);
    }

    // Step 4: try the full migration
    try {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Run each table creation individually
        const statements = [
          `CREATE TABLE IF NOT EXISTS projects (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL, description TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS workbooks (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            filename TEXT NOT NULL, display_name TEXT, storage_key TEXT NOT NULL,
            columns JSONB NOT NULL DEFAULT '[]', row_count INTEGER NOT NULL DEFAULT 0,
            file_size_bytes BIGINT DEFAULT 0, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS custom_buckets (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            bucket_name TEXT NOT NULL UNIQUE, description TEXT,
            direct_ancestor TEXT, root_category TEXT,
            include_terms JSONB DEFAULT '[]', exclude_terms JSONB DEFAULT '[]',
            example_strings JSONB DEFAULT '[]',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS analyses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            workbook_id UUID NOT NULL REFERENCES workbooks(id) ON DELETE CASCADE,
            selected_column TEXT NOT NULL, ai_provider TEXT NOT NULL, ai_model TEXT,
            status TEXT NOT NULL DEFAULT 'pending', progress INTEGER NOT NULL DEFAULT 0, message TEXT,
            total_rows INTEGER DEFAULT 0, total_rows_processed INTEGER DEFAULT 0,
            exact_matches INTEGER DEFAULT 0, inclusive_matches INTEGER DEFAULT 0,
            ai_classified INTEGER DEFAULT 0, general_bucket_count INTEGER DEFAULT 0,
            token_usage JSONB DEFAULT '{}', bucket_distribution JSONB DEFAULT '{}',
            low_confidence_items JSONB DEFAULT '[]',
            started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
          `CREATE TABLE IF NOT EXISTS analysis_rows (
            id BIGSERIAL PRIMARY KEY,
            analysis_id UUID NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
            row_index INTEGER NOT NULL, original_value TEXT,
            all_columns JSONB NOT NULL DEFAULT '{}',
            industry TEXT NOT NULL DEFAULT 'General Industry',
            bucket_name TEXT NOT NULL DEFAULT 'General Industry',
            root_category TEXT, direct_ancestor TEXT,
            confidence REAL, reason TEXT,
            is_generic BOOLEAN NOT NULL DEFAULT FALSE,
            is_disqualified BOOLEAN NOT NULL DEFAULT FALSE
          )`,
          `CREATE TABLE IF NOT EXISTS jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'queued', progress INTEGER NOT NULL DEFAULT 0,
            message TEXT, result_id TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          )`,
        ];

        for (let i = 0; i < statements.length; i++) {
          await client.query(statements[i]);
        }
        await client.query("COMMIT");
        results.full_migration = "OK";
      } catch (migErr: unknown) {
        await client.query("ROLLBACK").catch(() => {});
        results.full_migration_error = migErr instanceof Error ? migErr.message : String(migErr);
      } finally {
        client.release();
      }
    } catch (clientErr: unknown) {
      results.client_error = clientErr instanceof Error ? clientErr.message : String(clientErr);
    }

    // Step 5: verify tables after migration
    const tablesAfter = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    results.tables_after = tablesAfter.rows.map(
      (r: { table_name: string }) => r.table_name
    );

  } catch (err: unknown) {
    results.error = err instanceof Error ? err.message : String(err);
  } finally {
    await pool.end();
  }

  return NextResponse.json(results);
}
