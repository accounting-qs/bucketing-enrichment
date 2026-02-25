import { Pool } from 'pg';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;

let sqliteDb: any;
let pgPool: Pool | null = null;

if (isProduction) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  // Auto-create tables for Postgres if they don't exist
  pgPool.query(`
        CREATE TABLE IF NOT EXISTS workbooks (
            id TEXT PRIMARY KEY,
            filename TEXT,
            uploadedAt TEXT,
            columns TEXT,
            rowCount INTEGER,
            storagePath TEXT
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            workbookId TEXT,
            selectedColumn TEXT,
            createdAt TEXT,
            stats TEXT
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            status TEXT,
            progress INTEGER DEFAULT 0,
            message TEXT,
            resultId TEXT,
            updatedAt TEXT
        );
    `).then(() => console.log(">>> DB Migration Successful"))
    .catch(err => console.error(">>> DB MIGRATION ERROR:", err));
} else {
  const DB_PATH = path.join(process.cwd(), 'data', 'demo.db');
  if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
    fs.mkdirSync(path.join(process.cwd(), 'data'));
  }
  sqliteDb = new Database(DB_PATH);

  // Initial SQLite schema
  sqliteDb.exec(`
        CREATE TABLE IF NOT EXISTS workbooks (
            id TEXT PRIMARY KEY,
            filename TEXT,
            uploadedAt TEXT,
            columns TEXT,
            rowCount INTEGER,
            storagePath TEXT
        );

        CREATE TABLE IF NOT EXISTS analyses (
            id TEXT PRIMARY KEY,
            workbookId TEXT,
            selectedColumn TEXT,
            createdAt TEXT,
            stats TEXT,
            FOREIGN KEY(workbookId) REFERENCES workbooks(id)
        );

        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            status TEXT,
            progress INTEGER DEFAULT 0,
            message TEXT,
            resultId TEXT,
            updatedAt TEXT
        );
    `);
}

/**
 * Universal query function that works for both SQLite (dev) and PG (prod)
 */
export async function query(sql: string, params: any[] = []): Promise<any> {
  if (pgPool) {
    // Convert all ? to $1, $2, etc. for Postgres
    let pgSql = sql;
    let i = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${i++}`);
    }
    const res = await pgPool.query(pgSql, params);
    // Map lowercase Postgres keys to CamelCase used in the app
    return res.rows.map(row => {
      const newRow: any = {};
      for (const key of Object.keys(row)) {
        if (key === 'uploadedat') newRow.uploadedAt = row[key];
        else if (key === 'rowcount') newRow.rowCount = row[key];
        else if (key === 'storagepath') newRow.storagePath = row[key];
        else if (key === 'workbookid') newRow.workbookId = row[key];
        else if (key === 'selectedcolumn') newRow.selectedColumn = row[key];
        else if (key === 'createdat') newRow.createdAt = row[key];
        else if (key === 'resultid') newRow.resultId = row[key];
        else if (key === 'updatedat') newRow.updatedAt = row[key];
        else newRow[key] = row[key];
      }
      return newRow;
    });
  } else {
    const stmt = sqliteDb.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...params);
    } else {
      return stmt.run(...params);
    }
  }
}

/**
 * Get a single record
 */
export async function getOne(sql: string, params: any[] = []): Promise<any> {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export default { query, getOne };
