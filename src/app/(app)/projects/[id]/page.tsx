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
  Terminal,
  Copy,
  ChevronRight,
} from "lucide-react";
import AnalysisConfigPanel, { type AnalysisConfig } from "@/components/AnalysisConfigPanel";
import { DEFAULT_TAXONOMY } from "@/lib/defaultTaxonomy";

// ── Log types ─────────────────────────────────────────────
interface AnalysisLog {
  id: number;
  created_at: string;
  level: "debug" | "info" | "warn" | "error";
  phase: string | null;
  message: string;
  details: Record<string, unknown> | null;
}
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
  const [logDrawerAnalysisId, setLogDrawerAnalysisId] = useState<string | null>(null);

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
    <>
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
                        <button
                          className="btn btn--ghost btn--sm"
                          style={{ fontSize: "0.72rem", padding: "3px 8px", display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}
                          onClick={(e) => { e.stopPropagation(); setLogDrawerAnalysisId(analysis.id); }}
                          title="View run logs"
                        >
                          <Terminal size={12} /> Logs
                        </button>
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

    {/* Log Drawer — rendered at page level, outside the step cards */}
    {logDrawerAnalysisId && (
      <AnalysisLogDrawer
        analysisId={logDrawerAnalysisId}
        onClose={() => setLogDrawerAnalysisId(null)}
      />
    )}
    </>
  );
}

// ── Analysis Log Drawer ─────────────────────────────────

const LOG_LEVEL_STYLES: Record<string, { bg: string; color: string; border: string; label: string }> = {
  error: { bg: "rgba(239,68,68,0.1)",   color: "#ef4444", border: "rgba(239,68,68,0.3)",   label: "ERR" },
  warn:  { bg: "rgba(234,179,8,0.08)",  color: "#d97706", border: "rgba(234,179,8,0.25)",  label: "WRN" },
  info:  { bg: "rgba(59,130,246,0.07)", color: "#3b82f6", border: "rgba(59,130,246,0.2)",  label: "INF" },
  debug: { bg: "rgba(148,163,184,0.06)",color: "#94a3b8", border: "rgba(148,163,184,0.15)",label: "DBG" },
};

function AnalysisLogDrawer({ analysisId, onClose }: { analysisId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<AnalysisLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<"all" | "error" | "warn" | "info">("all");
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analyses/${analysisId}/logs?limit=500`)
      .then(r => r.json())
      .then(data => { setLogs(data.logs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [analysisId]);

  // Auto-scroll to bottom (most recent / failing entry)
  useEffect(() => {
    if (!loading) setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [loading]);

  const filtered = useMemo(() => {
    if (levelFilter === "all") return logs;
    const priority: Record<string, number> = { error: 4, warn: 3, info: 2, debug: 1 };
    const minP = priority[levelFilter] || 0;
    return logs.filter(l => (priority[l.level] || 0) >= minP);
  }, [logs, levelFilter]);

  const handleCopy = () => {
    const text = filtered.map(l =>
      `[${new Date(l.created_at).toISOString()}] [${l.level.toUpperCase()}] [${l.phase || "—"}] ${l.message}` +
      (l.details ? "\n  " + JSON.stringify(l.details, null, 2).replace(/\n/g, "\n  ") : "")
    ).join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const errorCount = logs.filter(l => l.level === "error").length;
  const warnCount  = logs.filter(l => l.level === "warn").length;

  return (
    <>
      {/* Backdrop */}
      <div className="log-drawer__backdrop" onClick={onClose} />

      {/* Drawer panel */}
      <div className="log-drawer">
        {/* Header */}
        <div className="log-drawer__header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={16} style={{ color: "var(--primary)" }} />
            <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>Analysis Run Logs</span>
            {errorCount > 0 && (
              <span style={{ background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: "0.68rem", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>
                {errorCount} error{errorCount !== 1 ? "s" : ""}
              </span>
            )}
            {warnCount > 0 && (
              <span style={{ background: "rgba(234,179,8,0.12)", color: "#d97706", fontSize: "0.68rem", padding: "2px 7px", borderRadius: 10, fontWeight: 600 }}>
                {warnCount} warning{warnCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn btn--ghost btn--sm" onClick={handleCopy} style={{ fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4 }}>
              <Copy size={12} /> {copied ? "Copied!" : "Copy All"}
            </button>
            <button className="btn btn--ghost btn--sm" onClick={onClose} style={{ fontSize: "0.72rem" }}>✕ Close</button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="log-drawer__filters">
          {(["all", "error", "warn", "info"] as const).map(l => (
            <button
              key={l}
              className={`log-filter-btn ${levelFilter === l ? "log-filter-btn--active" : ""}`}
              onClick={() => setLevelFilter(l)}
            >
              {l === "all" ? `All (${logs.length})` : l === "error" ? `Errors (${errorCount})` : l === "warn" ? `Warnings (${warnCount})` : `Info (${logs.filter(x => x.level === "info").length})`}
            </button>
          ))}
        </div>

        {/* Log list */}
        <div className="log-drawer__body">
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 160, color: "#94a3b8", gap: 8 }}>
              <Loader2 size={16} className="spin" /> Loading logs...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "#64748b" }}>
              <Terminal size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: "0.85rem" }}>No logs found for this analysis.</p>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#94a3b8" }}>Logs are written for analyses run after this feature was deployed.</p>
            </div>
          ) : (
            filtered.map((log) => {
              const style = LOG_LEVEL_STYLES[log.level] || LOG_LEVEL_STYLES.debug;
              const isExpanded = expandedLog === log.id;
              const ts = new Date(log.created_at).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

              return (
                <div key={log.id} className="log-entry" style={{ borderLeft: `3px solid ${style.border}`, background: style.bg }}>
                  <div
                    className="log-entry__row"
                    onClick={() => log.details ? setExpandedLog(isExpanded ? null : log.id) : undefined}
                    style={{ cursor: log.details ? "pointer" : "default" }}
                  >
                    <span className="log-entry__time">{ts}</span>
                    <span className="log-entry__level" style={{ color: style.color, background: `${style.color}18` }}>{style.label}</span>
                    {log.phase && <span className="log-entry__phase">{log.phase}</span>}
                    <span className="log-entry__msg">{log.message}</span>
                    {log.details && (
                      <ChevronRight size={12} style={{ color: "#94a3b8", flexShrink: 0, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "none" }} />
                    )}
                  </div>
                  {isExpanded && log.details && (
                    <pre className="log-entry__details">{JSON.stringify(log.details, null, 2)}</pre>
                  )}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>
    </>
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

  // Build full 41-bucket list: ALL taxonomy buckets with counts (0 if none)
  // Any non-taxonomy bucket names (AI-invented) get merged into General Industry
  const fullBuckets: [string, number][] = useMemo(() => {
    const bucketMap = new Map<string, number>();
    const validNames = new Set<string>();
    // First add all taxonomy buckets with 0
    for (const b of DEFAULT_TAXONOMY) {
      bucketMap.set(b.bucket_name, 0);
      validNames.add(b.bucket_name);
    }
    // Then overlay actual counts — merge invalid names into General Industry
    for (const [name, count] of Object.entries(dist)) {
      if (validNames.has(name)) {
        bucketMap.set(name, (bucketMap.get(name) || 0) + (count as number));
      } else {
        // Merge AI-invented bucket into General Industry
        bucketMap.set("General Industry", (bucketMap.get("General Industry") || 0) + (count as number));
      }
    }
    return Array.from(bucketMap.entries()).sort(([, a], [, b]) => b - a);
  }, [dist]);

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
        <div className="analysis-explorer" style={{ gridTemplateColumns: "280px 1fr" }}>
          {/* Left: Grouped 3-level bucket tree */}
          <GroupedBucketTree
            taxonomy={DEFAULT_TAXONOMY}
            fullBuckets={fullBuckets}
            activeBucket={activeBucket}
            totalProcessed={totalProcessed}
            onBucketClick={handleBucketClick}
          />

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
                          {csvColumns.map((col: string) => {
                            const val = parsed[col] || "";
                            const isUrl = /^https?:\/\/|^www\./i.test(val);
                            return (
                              <td key={col} style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {isUrl ? (
                                  <a href={val.startsWith("http") ? val : `https://${val}`} target="_blank" rel="noopener noreferrer" style={{ color: "#10b981", textDecoration: "none" }}>
                                    {val}
                                  </a>
                                ) : val}
                              </td>
                            );
                          })}
                          <td>
                            <span className={`bucket-tag ${["General Industry", "Needs Manual Review", "Error / Failed Enrichment"].includes(row.bucket_name) ? "bucket-tag--general" : ""}`}>
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

// ── Grouped 3-level Bucket Tree ─────────────────────────────

const PARENT_COLORS_RESULTS: Record<string, string> = {
  "Technology Services": "#3b82f6",
  "Software & SaaS": "#8b5cf6",
  "Agencies": "#f59e0b",
  "Professional & Business Services": "#06b6d4",
  "Financial Services": "#10b981",
  "Real Estate": "#f97316",
  "Industrial & Operations": "#6b7280",
  "Healthcare": "#ef4444",
  "Non-Profit / Associations": "#ec4899",
  "General Industry": "#94a3b8",
};

const PARENT_ICONS_RESULTS: Record<string, string> = {
  "Technology Services": "🖥️",
  "Software & SaaS": "📦",
  "Agencies": "🎨",
  "Professional & Business Services": "💼",
  "Financial Services": "💰",
  "Real Estate": "🏠",
  "Industrial & Operations": "🏭",
  "Healthcare": "🏥",
  "Non-Profit / Associations": "🤝",
  "General Industry": "⚠️",
};

interface BucketDef { bucket_name: string; direct_ancestor: string; root_category: string; }

const FALLBACK_LEAF_NAMES = ["General Industry", "Needs Manual Review", "Error / Failed Enrichment"];

function GroupedBucketTree({
  taxonomy,
  fullBuckets,
  activeBucket,
  totalProcessed,
  onBucketClick,
}: {
  taxonomy: BucketDef[];
  fullBuckets: [string, number][];
  activeBucket: string;
  totalProcessed: number;
  onBucketClick: (b: string) => void;
}) {
  const countMap = useMemo(() => new Map(fullBuckets), [fullBuckets]);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [expandedChildren, setExpandedChildren] = useState<Record<string, boolean>>({});

  const tree = useMemo(() => {
    const t: Record<string, Record<string, string[]>> = {};
    for (const b of taxonomy) {
      const p = b.root_category || "General Industry";
      const c = b.direct_ancestor || "Other";
      if (!t[p]) t[p] = {};
      if (!t[p][c]) t[p][c] = [];
      t[p][c].push(b.bucket_name);
    }
    return t;
  }, [taxonomy]);

  const parents = useMemo(() => {
    const all = Object.keys(tree);
    const non = all.filter((p) => p !== "General Industry");
    return "General Industry" in tree ? [...non, "General Industry"] : non;
  }, [tree]);

  const toggleParent = (p: string) =>
    setExpandedParents((prev) => ({ ...prev, [p]: !prev[p] }));
  const toggleChild = (key: string) =>
    setExpandedChildren((prev) => ({ ...prev, [key]: !prev[key] }));

  const parentCount = (parent: string) =>
    Object.values(tree[parent] || {}).flat().reduce((s, leaf) => s + (countMap.get(leaf) || 0), 0);

  return (
    <div className="bucket-tree" style={{ maxHeight: 550 }}>
      {/* All row */}
      <button
        className={`bucket-tree__item ${activeBucket === "all" ? "bucket-tree__item--active" : ""}`}
        onClick={() => onBucketClick("all")}
        style={{ fontWeight: 600, fontSize: "0.78rem", padding: "8px 12px" }}
      >
        <span className="bucket-tree__icon">📂</span>
        <span className="bucket-tree__name">All Buckets</span>
        <span className="bucket-tree__count">{totalProcessed}</span>
      </button>

      <div style={{ height: 1, background: "var(--border)", margin: "2px 0 4px" }} />

      {parents.map((parent) => {
        const color = PARENT_COLORS_RESULTS[parent] || "#94a3b8";
        const icon = PARENT_ICONS_RESULTS[parent] || "📁";
        const total = parentCount(parent);
        const isOpen = expandedParents[parent] ?? false;
        const childMap = tree[parent] || {};

        return (
          <div key={parent}>
            <button
              className="bucket-tree__item"
              onClick={() => toggleParent(parent)}
              style={{ borderLeft: `3px solid ${color}`, paddingLeft: 9 }}
            >
              <span style={{ fontSize: "0.85rem", flexShrink: 0 }}>{icon}</span>
              <span className="bucket-tree__name" style={{ fontWeight: 600, fontSize: "0.72rem", color }}>
                {parent}
              </span>
              <span className="bucket-tree__count" style={{ background: `${color}22`, color }}>
                {total}
              </span>
            </button>

            {isOpen && Object.entries(childMap).map(([child, leaves]) => {
              const childKey = `${parent}::${child}`;
              const isChildOpen = expandedChildren[childKey] ?? false;
              const childTotal = leaves.reduce((s, l) => s + (countMap.get(l) || 0), 0);

              return (
                <div key={child}>
                  <button
                    className="bucket-tree__item"
                    onClick={() => toggleChild(childKey)}
                    style={{ paddingLeft: 22, fontSize: "0.71rem" }}
                  >
                    <span style={{ color: "#94a3b8", fontSize: "0.62rem", flexShrink: 0 }}>▸</span>
                    <span className="bucket-tree__name" style={{ color: "#64748b" }}>{child}</span>
                    <span className="bucket-tree__count" style={{ background: "rgba(100,116,139,0.12)", color: "#64748b" }}>
                      {childTotal}
                    </span>
                  </button>

                  {isChildOpen && leaves.map((leaf) => {
                    const count = countMap.get(leaf) || 0;
                    const isFallback = FALLBACK_LEAF_NAMES.includes(leaf);
                    return (
                      <button
                        key={leaf}
                        className={`bucket-tree__item ${
                          activeBucket === leaf ? "bucket-tree__item--active" : ""
                        } ${
                          isFallback ? "bucket-tree__item--general" : ""
                        } ${
                          count === 0 ? "bucket-tree__item--empty" : ""
                        }`}
                        onClick={() => onBucketClick(leaf)}
                        style={{ paddingLeft: 34, fontSize: "0.69rem" }}
                      >
                        <span style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: count > 0 ? color : "#cbd5e1",
                          flexShrink: 0,
                        }} />
                        <span className="bucket-tree__name">{leaf}</span>
                        <span className="bucket-tree__count">{count}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
