import { query, getOne } from "./db";
import type { DashboardStats, AnalysisSummary } from "@/types";

/**
 * Get aggregated statistics for the dashboard
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [projectCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM projects"
  );

  const [workbookCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM workbooks"
  );

  const [analysisCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM analyses WHERE status = 'completed'"
  );

  const [rowsProcessed] = await query<{ total: string | null }>(
    "SELECT COALESCE(SUM(total_rows_processed), 0) as total FROM analyses WHERE status = 'completed'"
  );

  const [avgConf] = await query<{ avg: string | null }>(
    "SELECT ROUND(AVG(confidence)::numeric, 4) as avg FROM analysis_rows WHERE confidence IS NOT NULL"
  );

  const bucketRows = await query<{ bucket_name: string; count: string }>(
    `SELECT bucket_name, COUNT(*) as count 
     FROM analysis_rows 
     GROUP BY bucket_name 
     ORDER BY count DESC`
  );
  const bucketDistribution: Record<string, number> = {};
  for (const row of bucketRows) {
    bucketDistribution[row.bucket_name] = parseInt(row.count, 10);
  }

  const recentAnalyses = await query<AnalysisSummary>(
    `SELECT 
       a.id,
       p.name as project_name,
       w.filename as workbook_filename,
       a.selected_column,
       a.ai_provider,
       a.status,
       a.total_rows,
       a.total_rows_processed,
       a.created_at,
       a.completed_at
     FROM analyses a
     JOIN projects p ON p.id = a.project_id
     JOIN workbooks w ON w.id = a.workbook_id
     ORDER BY a.created_at DESC
     LIMIT 10`
  );

  return {
    totalProjects: parseInt(projectCount.count, 10),
    totalWorkbooks: parseInt(workbookCount.count, 10),
    totalAnalyses: parseInt(analysisCount.count, 10),
    totalRowsProcessed: parseInt(rowsProcessed.total || "0", 10),
    avgConfidence: avgConf.avg ? parseFloat(avgConf.avg) : null,
    bucketDistribution,
    recentAnalyses,
  };
}

/**
 * Get statistics for a specific analysis
 */
export async function getAnalysisStats(analysisId: string) {
  const analysis = await getOne(
    "SELECT * FROM analyses WHERE id = $1",
    [analysisId]
  );

  if (!analysis) return null;

  const bucketRows = await query<{ bucket_name: string; count: string; avg_confidence: string }>(
    `SELECT bucket_name, COUNT(*) as count, ROUND(AVG(confidence)::numeric, 3) as avg_confidence
     FROM analysis_rows 
     WHERE analysis_id = $1 
     GROUP BY bucket_name 
     ORDER BY count DESC`,
    [analysisId]
  );

  const [genericCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM analysis_rows WHERE analysis_id = $1 AND is_generic = true",
    [analysisId]
  );

  const [dqCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM analysis_rows WHERE analysis_id = $1 AND is_disqualified = true",
    [analysisId]
  );

  return {
    analysis,
    bucketBreakdown: bucketRows.map((r) => ({
      bucketName: r.bucket_name,
      rowCount: parseInt(r.count, 10),
      avgConfidence: parseFloat(r.avg_confidence),
    })),
    genericCount: parseInt(genericCount.count, 10),
    disqualifiedCount: parseInt(dqCount.count, 10),
  };
}

/**
 * Get per-project statistics
 */
export async function getProjectStats(projectId: string) {
  const [workbookCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM workbooks WHERE project_id = $1",
    [projectId]
  );

  const [analysisCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM analyses WHERE project_id = $1",
    [projectId]
  );

  const [completedCount] = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM analyses WHERE project_id = $1 AND status = 'completed'",
    [projectId]
  );

  const [rowsProcessed] = await query<{ total: string | null }>(
    "SELECT COALESCE(SUM(total_rows_processed), 0) as total FROM analyses WHERE project_id = $1 AND status = 'completed'",
    [projectId]
  );

  return {
    workbookCount: parseInt(workbookCount.count, 10),
    analysisCount: parseInt(analysisCount.count, 10),
    completedCount: parseInt(completedCount.count, 10),
    totalRowsProcessed: parseInt(rowsProcessed.total || "0", 10),
  };
}
