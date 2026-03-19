"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Upload,
  FileSpreadsheet,
  Play,
  Download,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Pencil,
  Trash2,
  FolderTree,
  BarChart3,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface Workbook {
  id: string;
  filename: string;
  display_name: string | null;
  columns: string[];
  row_count: number;
  file_size_bytes: number;
  uploaded_at: string;
}

interface Analysis {
  id: string;
  workbook_id: string;
  selected_column: string;
  ai_provider: string;
  status: string;
  progress: number;
  message: string | null;
  total_rows: number;
  total_rows_processed: number;
  bucket_distribution: Record<string, number>;
  created_at: string;
  completed_at: string | null;
}

type Tab = "files" | "analyses" | "results";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("files");
  const [project, setProject] = useState<Project | null>(null);
  const [workbooks, setWorkbooks] = useState<Workbook[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedWorkbook, setSelectedWorkbook] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [aiProvider, setAiProvider] = useState("gemini");
  const [analyzing, setAnalyzing] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProject = useCallback(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/projects/${id}/workbooks`).then((r) => r.json()),
      fetch(`/api/projects/${id}/analyses`).then((r) => r.json()),
    ])
      .then(([proj, wbs, ans]) => {
        setProject(proj.project || proj);
        setWorkbooks(wbs.workbooks || []);
        setAnalyses(ans.analyses || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  // Poll for active analysis progress
  useEffect(() => {
    if (activeAnalysis && ["pending", "processing"].includes(activeAnalysis.status)) {
      pollRef.current = setInterval(async () => {
        const res = await fetch(`/api/analyses/${activeAnalysis.id}`);
        const data = await res.json();
        if (data.analysis) {
          setActiveAnalysis(data.analysis);
          if (["completed", "failed", "completed_partial"].includes(data.analysis.status)) {
            if (pollRef.current) clearInterval(pollRef.current);
            fetchProject();
          }
        }
      }, 2000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeAnalysis?.id, activeAnalysis?.status, fetchProject]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("projectId", id);
    try {
      const res = await fetch("/api/workbooks/upload", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        fetchProject();
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!selectedWorkbook || !selectedColumn) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/workbooks/${selectedWorkbook}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          column: selectedColumn,
          provider: aiProvider,
          projectId: id,
        }),
      });
      const data = await res.json();
      if (data.analysis) {
        setActiveAnalysis(data.analysis);
        setTab("analyses");
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = async (analysisId: string) => {
    const res = await fetch(`/api/analyses/${analysisId}/export`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enriched_export_${analysisId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteWorkbook = async (wbId: string) => {
    if (!confirm("Delete this file and all its analyses?")) return;
    await fetch(`/api/workbooks/${wbId}`, { method: "DELETE" });
    fetchProject();
  };

  const currentWorkbook = workbooks.find((w) => w.id === selectedWorkbook);

  if (loading) return <div className="page"><div className="loading-state">Loading project...</div></div>;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <Link href="/projects" className="page__back">
            <ArrowLeft size={16} /> Projects
          </Link>
          <h1 className="page__title">{project?.name || "Project"}</h1>
          {project?.description && (
            <p className="page__subtitle">{project.description}</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${tab === "files" ? "tab--active" : ""}`}
          onClick={() => setTab("files")}
        >
          <FileSpreadsheet size={16} />
          Files ({workbooks.length})
        </button>
        <button
          className={`tab ${tab === "analyses" ? "tab--active" : ""}`}
          onClick={() => setTab("analyses")}
        >
          <BarChart3 size={16} />
          Analyses ({analyses.length})
        </button>
        <button
          className={`tab ${tab === "results" ? "tab--active" : ""}`}
          onClick={() => setTab("results")}
        >
          <FolderTree size={16} />
          Results
        </button>
      </div>

      {/* Files Tab */}
      {tab === "files" && (
        <div className="tab-content">
          <div className="upload-section">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleUpload}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="upload-drop-zone">
              <Upload size={32} className="upload-drop-zone__icon" />
              <span className="upload-drop-zone__text">
                {uploading ? "Uploading..." : "Click to upload CSV file"}
              </span>
              <span className="upload-drop-zone__hint">
                Supports CSV files up to 100MB
              </span>
            </label>
          </div>

          {workbooks.length > 0 && (
            <div className="file-list">
              {workbooks.map((wb) => (
                <div
                  key={wb.id}
                  className={`file-item ${selectedWorkbook === wb.id ? "file-item--selected" : ""}`}
                  onClick={() => setSelectedWorkbook(wb.id)}
                >
                  <div className="file-item__info">
                    <FileSpreadsheet size={18} />
                    <div>
                      <span className="file-item__name">
                        {wb.display_name || wb.filename}
                      </span>
                      <span className="file-item__meta">
                        {wb.row_count.toLocaleString()} rows · {wb.columns.length} columns · {(wb.file_size_bytes / 1024 / 1024).toFixed(1)}MB
                      </span>
                    </div>
                  </div>
                  <div className="file-item__actions">
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWorkbook(wb.id); }}
                      className="btn-icon btn-icon--danger"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Analysis Setup (when file selected) */}
          {currentWorkbook && (
            <div className="card analyze-card">
              <div className="card__header">
                <h3 className="card__title">Run Analysis</h3>
              </div>
              <div className="card__body">
                <label className="form-label">
                  Select Column
                  <select
                    value={selectedColumn}
                    onChange={(e) => setSelectedColumn(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Choose column...</option>
                    {currentWorkbook.columns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  AI Provider
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="form-input"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI GPT-4o</option>
                    <option value="claude">Anthropic Claude</option>
                    <option value="openrouter">OpenRouter (Free)</option>
                  </select>
                </label>
                <button
                  onClick={handleAnalyze}
                  disabled={!selectedColumn || analyzing}
                  className="btn btn--primary btn--lg"
                >
                  {analyzing ? (
                    <><Loader2 size={18} className="spin" /> Starting Analysis...</>
                  ) : (
                    <><Play size={18} /> Run Analysis</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Analyses Tab */}
      {tab === "analyses" && (
        <div className="tab-content">
          {activeAnalysis && ["pending", "processing"].includes(activeAnalysis.status) && (
            <div className="card progress-card">
              <div className="card__header">
                <h3 className="card__title">Analysis in Progress</h3>
                <span className="status-badge status-badge--processing">Processing</span>
              </div>
              <div className="card__body">
                <div className="progress-bar">
                  <div
                    className="progress-bar__fill"
                    style={{ width: `${activeAnalysis.progress}%` }}
                  />
                </div>
                <p className="progress-message">
                  {activeAnalysis.message || `${activeAnalysis.progress}% complete`}
                </p>
              </div>
            </div>
          )}

          {analyses.length === 0 ? (
            <div className="empty-state">
              <p>No analyses yet. Upload a file and run analysis from the Files tab.</p>
            </div>
          ) : (
            <div className="analysis-list">
              {analyses.map((a) => (
                <div key={a.id} className="analysis-item">
                  <div className="analysis-item__info">
                    <span className={`status-badge status-badge--${a.status}`}>
                      {a.status === "completed" ? <CheckCircle2 size={14} /> : a.status === "failed" ? <XCircle size={14} /> : null}
                      {a.status}
                    </span>
                    <span className="analysis-item__column">Column: {a.selected_column}</span>
                    <span className="analysis-item__provider">{a.ai_provider}</span>
                    <span className="analysis-item__rows">
                      {a.total_rows_processed?.toLocaleString()} / {a.total_rows?.toLocaleString()} rows
                    </span>
                  </div>
                  <div className="analysis-item__actions">
                    <span className="analysis-item__date">
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                    {a.status === "completed" && (
                      <button
                        onClick={() => handleExport(a.id)}
                        className="btn btn--sm btn--ghost"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results Tab */}
      {tab === "results" && (
        <div className="tab-content">
          {analyses.filter((a) => a.status === "completed").length === 0 ? (
            <div className="empty-state">
              <p>Complete an analysis to view results here.</p>
            </div>
          ) : (
            <div>
              {analyses
                .filter((a) => a.status === "completed")
                .map((a) => (
                  <div key={a.id} className="card results-card">
                    <div className="card__header">
                      <h3 className="card__title">
                        Analysis: {a.selected_column}
                      </h3>
                      <button
                        onClick={() => handleExport(a.id)}
                        className="btn btn--sm btn--primary"
                      >
                        <Download size={14} /> Export CSV
                      </button>
                    </div>
                    <div className="card__body">
                      <div className="results-stats">
                        <div className="results-stat">
                          <span className="results-stat__value">{a.total_rows?.toLocaleString()}</span>
                          <span className="results-stat__label">Total Rows</span>
                        </div>
                        <div className="results-stat">
                          <span className="results-stat__value">{a.total_rows_processed?.toLocaleString()}</span>
                          <span className="results-stat__label">Processed</span>
                        </div>
                        <div className="results-stat">
                          <span className="results-stat__value">
                            {Object.keys(a.bucket_distribution || {}).length}
                          </span>
                          <span className="results-stat__label">Buckets Used</span>
                        </div>
                      </div>
                      {a.bucket_distribution && (
                        <div className="bucket-bars">
                          {Object.entries(a.bucket_distribution)
                            .sort((a, b) => b[1] - a[1])
                            .map(([name, count]) => {
                              const max = Math.max(...Object.values(a.bucket_distribution));
                              return (
                                <div key={name} className="bucket-bar">
                                  <div className="bucket-bar__label">
                                    <span className="bucket-bar__name">{name}</span>
                                    <span className="bucket-bar__count">{count.toLocaleString()}</span>
                                  </div>
                                  <div className="bucket-bar__track">
                                    <div
                                      className="bucket-bar__fill"
                                      style={{ width: `${(count / max) * 100}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
