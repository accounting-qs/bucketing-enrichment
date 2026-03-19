"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Download,
  Clock,
  Sparkles,
  XCircle,
} from "lucide-react";
import AnalysisConfigPanel, { type AnalysisConfig } from "@/components/AnalysisConfigPanel";

// ── Types ───────────────────────────────────────────────
interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface Workbook {
  id: string;
  filename: string;
  columns: string[];
  row_count: number;
  file_size_bytes: number;
  uploaded_at: string;
}

interface Analysis {
  id: string;
  selected_column: string;
  ai_provider: string;
  ai_model: string | null;
  analysis_mode: string;
  status: string;
  progress: number;
  message: string | null;
  total_rows: number;
  total_rows_processed: number;
  exact_matches: number;
  ai_classified: number;
  general_bucket_count: number;
  estimated_cost: number;
  bucket_distribution: Record<string, number>;
  created_at: string;
  completed_at: string | null;
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── State ─────────────────────────────────────────────
  const [project, setProject] = useState<Project | null>(null);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [analyzing, setAnalyzing] = useState(false);
  const [selectedWorkbook, setSelectedWorkbook] = useState<Workbook | null>(null);

  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true, 2: false, 3: false,
  });
  const [expandedAnalysis, setExpandedAnalysis] = useState<string | null>(null);

  // ── Data Fetching ─────────────────────────────────────
  const fetchProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    if (res.ok) {
      const data = await res.json();
      setProject(data.project || data);
    }
  }, [id]);

  const fetchWorkbooks = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/workbooks`);
    if (res.ok) {
      const data = await res.json();
      const raw = data.workbooks || data || [];
      const wbs = (Array.isArray(raw) ? raw : []).map((w: Workbook & { columns: string | string[] }) => ({
        ...w,
        columns: typeof w.columns === "string" ? JSON.parse(w.columns) : (w.columns || []),
      }));
      setWorkbooks(wbs);
      if (wbs.length > 0 && !selectedWorkbook) {
        setSelectedWorkbook(wbs[0]);
        setExpandedSteps((s) => ({ ...s, 2: true }));
      }
    }
  }, [id, selectedWorkbook]);

  const fetchAnalyses = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/analyses`);
    if (res.ok) {
      const data = await res.json();
      const raw = data.analyses || data || [];
      const parsed = (Array.isArray(raw) ? raw : []).map((a: Analysis & { bucket_distribution: string | Record<string, number> }) => ({
        ...a,
        bucket_distribution: typeof a.bucket_distribution === "string"
          ? JSON.parse(a.bucket_distribution)
          : (a.bucket_distribution || {}),
      }));
      setAnalyses(parsed);
      if (parsed.length > 0) setExpandedSteps((s) => ({ ...s, 3: true }));
    }
  }, [id]);

  useEffect(() => {
    Promise.all([fetchProject(), fetchWorkbooks(), fetchAnalyses()])
      .finally(() => setLoading(false));
  }, [fetchProject, fetchWorkbooks, fetchAnalyses]);

  // Poll for active analyses
  useEffect(() => {
    const active = analyses.some((a) => a.status === "processing" || a.status === "pending");
    if (!active) return;
    const interval = setInterval(fetchAnalyses, 3000);
    return () => clearInterval(interval);
  }, [analyses, fetchAnalyses]);

  // ── Handlers ──────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(10);
    setExpandedSteps((s) => ({ ...s, 1: true }));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", id);

    try {
      setUploadProgress(40);
      const res = await fetch("/api/workbooks/upload", { method: "POST", body: formData });
      setUploadProgress(90);

      if (res.ok) {
        await fetchWorkbooks();
        setUploadProgress(100);
        setExpandedSteps((s) => ({ ...s, 2: true }));
      } else {
        console.error("Upload error:", await res.text());
      }
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleRunAnalysis = async (config: AnalysisConfig) => {
    if (!selectedWorkbook) return;

    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch(`/api/workbooks/${selectedWorkbook.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column: config.column,
          provider: config.model?.provider || "deterministic",
          model: config.model?.id || null,
          projectId: id,
          analysisMode: config.analysisMode,
          rowLimit: config.rowLimit,
          minBucketThreshold: config.minBucketThreshold,
        }),
      });

      if (res.ok) {
        await fetchAnalyses();
        setExpandedSteps((s) => ({ ...s, 3: true }));
      } else {
        const errData = await res.json().catch(() => ({ error: "Unknown error" }));
        setAnalysisError(errData.error || `Server error (${res.status})`);
      }
    } catch (err) {
      setAnalysisError(`Network error: ${String(err)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleStep = (step: number) => {
    setExpandedSteps((s) => ({ ...s, [step]: !s[step] }));
  };

  // ── Helpers ───────────────────────────────────────────
  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const getStatusClass = (status: string) => {
    const map: Record<string, string> = {
      completed: "status-badge--completed",
      processing: "status-badge--processing",
      pending: "status-badge--pending",
      failed: "status-badge--failed",
      completed_partial: "status-badge--active",
    };
    return map[status] || "";
  };

  const hasFiles = workbooks.length > 0;
  const hasAnalyses = analyses.length > 0;
  const activeAnalysis = analyses.find((a) => a.status === "processing" || a.status === "pending");

  if (loading) return <div className="loading-state">Loading project...</div>;
  if (!project) return <div className="empty-state">Project not found</div>;

  return (
    <div className="page">
      {/* Header */}
      <div className="page__header">
        <button className="page__back" onClick={() => router.push("/projects")}>
          <ArrowLeft size={16} /> Projects
        </button>
        <div>
          <h1 className="page__title">{project.name}</h1>
          {project.description && (
            <p className="page__subtitle">{project.description}</p>
          )}
        </div>
      </div>

      {/* Step 1: Upload Files */}
      <div className={`step-card ${expandedSteps[1] ? "step-card--active" : ""} ${hasFiles ? "step-card--done" : ""}`}>
        <div className="step-card__header" onClick={() => toggleStep(1)}>
          <div className="step-card__number">{hasFiles ? <CheckCircle2 size={16} /> : "1"}</div>
          <span className="step-card__title">Upload Files</span>
          <span className="step-card__badge">{workbooks.length} file{workbooks.length !== 1 ? "s" : ""}</span>
          {expandedSteps[1] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {expandedSteps[1] && (
          <div className="step-card__body">
            {/* Upload zone */}
            <div
              className="upload-drop-zone"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 size={28} className="upload-drop-zone__icon spin" />
                  <span>Uploading... {uploadProgress}%</span>
                  <div className="progress-bar" style={{ marginTop: 8, width: "100%", maxWidth: 300 }}>
                    <div className="progress-bar__fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </>
              ) : (
                <>
                  <Upload size={28} className="upload-drop-zone__icon" />
                  <span>Drop a CSV here or click to upload</span>
                  <span className="upload-drop-zone__hint">Supports .csv files</span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleUpload}
                className="hidden"
              />
            </div>

            {/* File list */}
            {workbooks.map((wb) => (
              <div
                key={wb.id}
                className={`file-item ${selectedWorkbook?.id === wb.id ? "file-item--selected" : ""}`}
                onClick={() => {
                  setSelectedWorkbook(wb);
                  setExpandedSteps((s) => ({ ...s, 2: true }));
                }}
                style={{ cursor: "pointer", marginTop: 8 }}
              >
                <div className="file-item__icon">
                  <FileText size={20} />
                </div>
                <div className="file-item__info">
                  <span className="file-item__name">{wb.filename}</span>
                  <span className="file-item__meta">
                    {wb.row_count.toLocaleString()} rows · {wb.columns.length} columns · {formatBytes(wb.file_size_bytes)}
                  </span>
                </div>
                {selectedWorkbook?.id === wb.id && (
                  <span className="badge badge--info" style={{ marginLeft: "auto" }}>Selected</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step 2: Configure Analysis */}
      <div className={`step-card ${expandedSteps[2] ? "step-card--active" : ""}`}>
        <div className="step-card__header" onClick={() => toggleStep(2)}>
          <div className="step-card__number">2</div>
          <span className="step-card__title">Configure Analysis</span>
          {selectedWorkbook && (
            <span className="step-card__badge">{selectedWorkbook.filename}</span>
          )}
          {expandedSteps[2] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {expandedSteps[2] && (
          <div className="step-card__body">
            {!selectedWorkbook ? (
              <div className="empty-state">
                <p>Upload a file first to configure analysis</p>
              </div>
            ) : (
              <>
                <AnalysisConfigPanel
                  columns={selectedWorkbook.columns}
                  totalRows={selectedWorkbook.row_count}
                  onRunAnalysis={handleRunAnalysis}
                  disabled={analyzing || !!activeAnalysis}
                />
                {analysisError && (
                  <div style={{
                    marginTop: 12, padding: "12px 16px",
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 8, color: "#ef4444", fontSize: "0.85rem",
                    display: "flex", alignItems: "center", gap: 8,
                  }}>
                    <XCircle size={16} />
                    <span><strong>Error:</strong> {analysisError}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Active Analysis Progress */}
      {activeAnalysis && (
        <div className="step-card step-card--active" style={{ borderColor: "var(--accent-blue)" }}>
          <div className="step-card__header">
            <Loader2 size={20} className="spin" style={{ color: "var(--accent-blue)" }} />
            <span className="step-card__title">Analysis In Progress</span>
            <span className={`status-badge ${getStatusClass(activeAnalysis.status)}`}>
              {activeAnalysis.status}
            </span>
          </div>
          <div className="step-card__body">
            <div className="progress-bar" style={{ marginBottom: 8 }}>
              <div className="progress-bar__fill" style={{ width: `${activeAnalysis.progress}%` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "#64748b" }}>
              <span>{activeAnalysis.message || "Processing..."}</span>
              <span>{activeAnalysis.progress}%</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: "0.78rem", color: "#94a3b8" }}>
              <span>{activeAnalysis.total_rows_processed}/{activeAnalysis.total_rows} rows</span>
              <span>Mode: {activeAnalysis.analysis_mode.replace(/_/g, " ")}</span>
              <span>Provider: {activeAnalysis.ai_provider}</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      <div className={`step-card ${expandedSteps[3] ? "step-card--active" : ""} ${hasAnalyses ? "step-card--done" : ""}`}>
        <div className="step-card__header" onClick={() => toggleStep(3)}>
          <div className="step-card__number">{hasAnalyses ? <CheckCircle2 size={16} /> : "3"}</div>
          <span className="step-card__title">Results</span>
          <span className="step-card__badge">{analyses.length} analysis{analyses.length !== 1 ? "es" : ""}</span>
          {expandedSteps[3] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>

        {expandedSteps[3] && (
          <div className="step-card__body">
            {analyses.length === 0 ? (
              <div className="empty-state">
                <BarChart3 size={32} className="empty-state__icon" />
                <h3>No analyses yet</h3>
                <p>Configure and run an analysis above to see results</p>
              </div>
            ) : (
              analyses
                .filter((a) => a.status !== "processing" && a.status !== "pending")
                .map((analysis) => {
                  const isExpanded = expandedAnalysis === analysis.id;
                  const dist = analysis.bucket_distribution || {};
                  const sorted = Object.entries(dist).sort(([, a], [, b]) => b - a);
                  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
                  const totalProcessed = analysis.total_rows_processed || analysis.total_rows;

                  return (
                    <div key={analysis.id} className="analysis-card" style={{ marginBottom: 12 }}>
                      {/* Analysis header */}
                      <div
                        className="file-item"
                        onClick={() => setExpandedAnalysis(isExpanded ? null : analysis.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="file-item__icon">
                          {analysis.status === "completed" ? (
                            <CheckCircle2 size={20} style={{ color: "var(--primary)" }} />
                          ) : analysis.status === "failed" ? (
                            <XCircle size={20} style={{ color: "var(--accent-red)" }} />
                          ) : (
                            <Clock size={20} />
                          )}
                        </div>
                        <div className="file-item__info">
                          <span className="file-item__name">
                            {analysis.selected_column} — {analysis.analysis_mode.replace(/_/g, " ")}
                          </span>
                          <span className="file-item__meta">
                            {totalProcessed.toLocaleString()} rows ·
                            {analysis.ai_provider !== "deterministic" ? ` ${analysis.ai_model || analysis.ai_provider} · ` : " "}
                            {Object.keys(dist).length} buckets
                            {analysis.estimated_cost > 0 ? ` · $${Number(analysis.estimated_cost).toFixed(4)}` : " · Free"}
                          </span>
                        </div>
                        <span className={`status-badge ${getStatusClass(analysis.status)}`}>
                          {analysis.status}
                        </span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <AnalysisDetails analysis={analysis} sorted={sorted} maxCount={maxCount} totalProcessed={totalProcessed} />
                      )}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Analysis Details Sub-Component ──────────────────────

interface AnalysisRow {
  id: number;
  row_index: number;
  original_value: string;
  all_columns: string | Record<string, string>;
  bucket_name: string;
  confidence: number | null;
  reason: string | null;
  is_generic: boolean;
  is_disqualified: boolean;
  cost_usd: number;
}

function parseAllColumns(raw: string | Record<string, string>): Record<string, string> {
  if (typeof raw === "object" && raw !== null) return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function AnalysisDetails({
  analysis,
  sorted,
  maxCount,
  totalProcessed,
}: {
  analysis: Analysis;
  sorted: [string, number][];
  maxCount: number;
  totalProcessed: number;
}) {
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRowCount, setTotalRowCount] = useState(0);
  const [activeBucket, setActiveBucket] = useState("all");
  const [showTable, setShowTable] = useState(false);

  const dist = analysis.bucket_distribution || {};

  const fetchRows = useCallback(async (p: number, bucket: string) => {
    setLoadingRows(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: "50",
        sort: "row_index",
        order: "asc",
      });
      if (bucket && bucket !== "all") params.set("bucket", bucket);

      const res = await fetch(`/api/analyses/${analysis.id}/rows?${params}`);
      if (res.ok) {
        const data = await res.json();
        setRows(data.rows || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalRowCount(data.pagination?.total || 0);
        setPage(data.pagination?.page || 1);
      }
    } catch (err) {
      console.error("Failed to load rows:", err);
    } finally {
      setLoadingRows(false);
    }
  }, [analysis.id]);

  useEffect(() => {
    if (showTable) fetchRows(1, activeBucket);
  }, [showTable, activeBucket, fetchRows]);

  // Extract CSV column names from first row's all_columns
  const csvColumns = useMemo(() => {
    if (rows.length === 0) return [];
    const parsed = parseAllColumns(rows[0].all_columns);
    return Object.keys(parsed);
  }, [rows]);

  const handleBucketClick = (bucket: string) => {
    setActiveBucket(bucket);
    setPage(1);
  };

  return (
    <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="results-stat">
          <span className="results-stat__value">{analysis.exact_matches}</span>
          <span className="results-stat__label">High Confidence</span>
        </div>
        <div className="results-stat">
          <span className="results-stat__value">{analysis.ai_classified}</span>
          <span className="results-stat__label">AI Classified</span>
        </div>
        <div className="results-stat">
          <span className="results-stat__value">{analysis.general_bucket_count}</span>
          <span className="results-stat__label">General</span>
        </div>
        <div className="results-stat">
          <span className="results-stat__value">
            {analysis.estimated_cost > 0 ? `$${Number(analysis.estimated_cost).toFixed(4)}` : "$0"}
          </span>
          <span className="results-stat__label">Total Cost</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <a href={`/api/analyses/${analysis.id}/export`} className="btn btn--ghost" style={{ fontSize: "0.82rem" }}>
          <Download size={14} /> Export CSV
        </a>
        <button
          className="btn btn--ghost"
          style={{ fontSize: "0.82rem" }}
          onClick={() => setShowTable(!showTable)}
        >
          <BarChart3 size={14} /> {showTable ? "Hide" : "View"} Data Table
        </button>
      </div>

      {/* Split-pane: Bucket Tree + Data Table */}
      {showTable && (
        <div className="analysis-explorer">
          {/* Left: Bucket tree sidebar */}
          <div className="bucket-tree">
            <button
              className={`bucket-tree__item ${activeBucket === "all" ? "bucket-tree__item--active" : ""}`}
              onClick={() => handleBucketClick("all")}
            >
              <span className="bucket-tree__icon">📂</span>
              <span className="bucket-tree__name">All</span>
              <span className="bucket-tree__count">{totalProcessed}</span>
            </button>
            {sorted.map(([bucket, count]) => (
              <button
                key={bucket}
                className={`bucket-tree__item ${activeBucket === bucket ? "bucket-tree__item--active" : ""} ${bucket === "General Industry" ? "bucket-tree__item--general" : ""}`}
                onClick={() => handleBucketClick(bucket)}
              >
                <span className="bucket-tree__icon">{bucket === "General Industry" ? "📁" : "📄"}</span>
                <span className="bucket-tree__name">{bucket}</span>
                <span className="bucket-tree__count">{count}</span>
              </button>
            ))}
          </div>

          {/* Right: Data table */}
          <div className="analysis-table-wrap">
            {/* Header */}
            <div className="analysis-table-header">
              <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                {activeBucket === "all" ? "All Buckets" : activeBucket}
              </span>
              <span style={{ fontSize: "0.72rem", color: "#94a3b8" }}>
                Page {page}/{totalPages} · {totalRowCount} rows
              </span>
            </div>

            {loadingRows ? (
              <div className="loading-state" style={{ padding: 32 }}>Loading rows...</div>
            ) : (
              <div style={{ overflowX: "auto", maxHeight: 500, overflowY: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, zIndex: 2, background: "var(--card-bg)" }}>#</th>
                      {csvColumns.map((col: string) => (
                        <th key={col}>{col}</th>
                      ))}
                      <th>Bucket</th>
                      <th>Confidence</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const parsed = parseAllColumns(row.all_columns);
                      return (
                        <tr key={row.id}>
                          <td style={{ position: "sticky", left: 0, zIndex: 1, background: "var(--card-bg)", fontVariantNumeric: "tabular-nums" }}>
                            {row.row_index + 1}
                          </td>
                          {csvColumns.map((col: string) => (
                            <td key={col} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {parsed[col] || ""}
                            </td>
                          ))}
                          <td>
                            <span className={`bucket-tag ${row.bucket_name === "General Industry" ? "bucket-tag--general" : ""}`}>
                              {row.bucket_name}
                            </span>
                          </td>
                          <td>
                            {row.confidence != null ? (
                              <span className={`confidence-badge ${row.confidence >= 0.7 ? "confidence--high" : row.confidence >= 0.4 ? "confidence--mid" : "confidence--low"}`}>
                                {Math.round(row.confidence * 100)}%
                              </span>
                            ) : "—"}
                          </td>
                          <td style={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.72rem", color: "#94a3b8" }}>
                            {row.reason || "—"}
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={csvColumns.length + 4} style={{ textAlign: "center", padding: 32, color: "#94a3b8" }}>No rows found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "8px 0" }}>
                <button className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => fetchRows(page - 1, activeBucket)}>
                  ← Prev
                </button>
                <span style={{ fontSize: "0.78rem", lineHeight: "32px", color: "#94a3b8" }}>
                  {page} / {totalPages}
                </span>
                <button className="btn btn--ghost btn--sm" disabled={page >= totalPages} onClick={() => fetchRows(page + 1, activeBucket)}>
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

