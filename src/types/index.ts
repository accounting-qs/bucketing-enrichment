// ============================================================
// Quantum Enricher — TypeScript Type Definitions
// ============================================================

// --- Projects ---

export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

// --- Workbooks ---

export interface Workbook {
  id: string;
  project_id: string;
  filename: string;
  display_name: string | null;
  storage_key: string;
  columns: string[];
  row_count: number;
  file_size_bytes: number;
  uploaded_at: string;
}

// --- Taxonomy / Buckets ---

export interface BucketDefinition {
  bucket_name: string;
  description: string;
  direct_ancestor: string;
  root_category: string;
  include: string[];
  exclude: string[];
  example_strings: string[];
}

export interface CustomBucket {
  id: string;
  bucket_name: string;
  description: string | null;
  direct_ancestor: string | null;
  root_category: string | null;
  include_terms: string[];
  exclude_terms: string[];
  example_strings: string[];
  created_at: string;
}

// --- Analyses ---

export interface Analysis {
  id: string;
  project_id: string;
  workbook_id: string;
  selected_column: string;
  ai_provider: string;
  ai_model: string | null;
  status: "pending" | "processing" | "completed" | "failed" | "paused" | "completed_partial";
  progress: number;
  message: string | null;
  analysis_mode: "ai_only" | "deterministic_only" | "deterministic_then_ai" | "ai_then_deterministic";
  row_limit: number | null;
  min_bucket_threshold: number;
  estimated_cost: number;

  // Metrics
  total_rows: number;
  total_rows_processed: number;
  exact_matches: number;
  inclusive_matches: number;
  ai_classified: number;
  general_bucket_count: number;
  token_usage: TokenUsage;
  bucket_distribution: Record<string, number>;
  low_confidence_items: LowConfidenceItem[];

  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LowConfidenceItem {
  value: string;
  bucket_name: string;
  confidence: number;
  reason: string;
}

// --- Analysis Rows ---

export interface AnalysisRow {
  id: number;
  analysis_id: string;
  row_index: number;
  original_value: string | null;
  all_columns: Record<string, unknown>;
  industry: string;
  bucket_name: string;
  root_category: string | null;
  direct_ancestor: string | null;
  confidence: number | null;
  reason: string | null;
  is_generic: boolean;
  is_disqualified: boolean;
  cost_usd: number;
}

// --- Jobs ---

export interface Job {
  id: string;
  analysis_id: string | null;
  status: "queued" | "processing" | "completed" | "completed_partial" | "failed" | "cancelling" | "cancelled";
  progress: number;
  message: string | null;
  result_id: string | null;
  updated_at: string;
}

// --- Dashboard Stats ---

export interface DashboardStats {
  totalProjects: number;
  totalWorkbooks: number;
  totalAnalyses: number;
  totalRowsProcessed: number;
  avgConfidence: number | null;
  bucketDistribution: Record<string, number>;
  recentAnalyses: AnalysisSummary[];
}

export interface AnalysisSummary {
  id: string;
  project_name: string;
  workbook_filename: string;
  selected_column: string;
  ai_provider: string;
  status: string;
  total_rows: number;
  total_rows_processed: number;
  created_at: string;
  completed_at: string | null;
}

// --- AI Provider ---

export type AIProvider = "gemini" | "openai" | "claude" | "openrouter";

// --- Bucket Node (for tree view) ---

export interface BucketNode {
  id: string;
  name: string;
  rowCount: number;
  childrenCount: number;
  children: BucketNode[];
  depth: number;
}
