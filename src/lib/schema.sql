-- Quantum Enricher — Full PostgreSQL Schema
-- Run this migration to set up or reset the database

-- Projects: top-level container for all work
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Workbooks: uploaded CSV files (content stored on Cloudflare R2)
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

-- Custom taxonomy buckets (user-added, on top of the 25 defaults)
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

-- Analyses: each classification run
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

  -- Full metrics
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

-- Analysis rows: per-row classification result (preserves ALL original columns)
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

-- Jobs: background worker tracking
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  result_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workbooks_project ON workbooks(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_project ON analyses(project_id);
CREATE INDEX IF NOT EXISTS idx_analyses_workbook ON analyses(workbook_id);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_analysis ON analysis_rows(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_bucket ON analysis_rows(analysis_id, bucket_name);
CREATE INDEX IF NOT EXISTS idx_analysis_rows_industry ON analysis_rows(analysis_id, industry);
CREATE INDEX IF NOT EXISTS idx_jobs_analysis ON jobs(analysis_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
