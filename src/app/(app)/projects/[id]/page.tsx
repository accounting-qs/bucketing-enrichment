"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

                          {/* Bucket distribution */}
                          <h4 style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: 8 }}>
                            Bucket Distribution
                          </h4>
                          <div className="bucket-list">
                            {sorted.map(([bucket, count]) => (
                              <div key={bucket} className="bucket-bar">
                                <div className="bucket-bar__header">
                                  <span className="bucket-bar__name">{bucket}</span>
                                  <span className="bucket-bar__count">
                                    {count} ({totalProcessed > 0 ? Math.round((count / totalProcessed) * 100) : 0}%)
                                  </span>
                                </div>
                                <div className="bucket-bar__track">
                                  <div
                                    className="bucket-bar__fill"
                                    style={{ width: `${(count / maxCount) * 100}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Actions */}
                          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                            <a
                              href={`/api/analyses/${analysis.id}/export`}
                              className="btn btn--ghost"
                              style={{ fontSize: "0.82rem" }}
                            >
                              <Download size={14} /> Export CSV
                            </a>
                          </div>
                        </div>
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
