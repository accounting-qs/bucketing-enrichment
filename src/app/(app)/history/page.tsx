"use client";

import { useEffect, useState } from "react";
import { History as HistoryIcon, Download, Search } from "lucide-react";

interface AnalysisRecord {
  id: string;
  project_name: string;
  workbook_filename: string;
  selected_column: string;
  ai_provider: string;
  ai_model: string | null;
  status: string;
  total_rows: number;
  total_rows_processed: number;
  exact_matches: number;
  inclusive_matches: number;
  ai_classified: number;
  general_bucket_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

function formatTime(isoStr: string | null): string {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatElapsed(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const diffMs = Math.max(0, end - start);

  if (diffMs < 1000) return "<1s";
  const totalSec = Math.round(diffMs / 1000);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

export default function HistoryPage() {
  const [analyses, setAnalyses] = useState<AnalysisRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((data) => setAnalyses(data.analyses || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

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

  const filtered = analyses.filter((a) => {
    const matchesSearch =
      a.project_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.workbook_filename?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">
            <HistoryIcon size={28} className="page__title-icon" />
            Analysis History
          </h1>
          <p className="page__subtitle">
            All analyses across all projects
          </p>
        </div>
      </div>

      <div className="filters-row">
        <div className="search-bar">
          <Search size={18} className="search-bar__icon" />
          <input
            type="text"
            placeholder="Search by project or file..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-bar__input"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form-input form-input--sm"
        >
          <option value="all">All Status</option>
          <option value="completed">Completed</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {loading ? (
        <div className="loading-state">Loading history...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state empty-state--large">
          <HistoryIcon size={48} className="empty-state__icon" />
          <h3>No analyses found</h3>
          <p>Run an analysis from a project to see it here.</p>
        </div>
      ) : (
        <div className="history-table-wrapper">
          <table className="history-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>File</th>
                <th>Column</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Processed</th>
                <th>Started</th>
                <th>Completed</th>
                <th>Elapsed</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td className="td-project">{a.project_name}</td>
                  <td className="td-file">{a.workbook_filename}</td>
                  <td>{a.selected_column}</td>
                  <td className="td-provider">{a.ai_provider}</td>
                  <td>
                    <span className={`status-badge status-badge--${a.status}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>{a.total_rows?.toLocaleString()}</td>
                  <td>{a.total_rows_processed?.toLocaleString()}</td>
                  <td className="td-time">{formatTime(a.started_at)}</td>
                  <td className="td-time">{formatTime(a.completed_at)}</td>
                  <td className="td-elapsed">
                    <span className={`elapsed-badge ${a.status === "processing" ? "elapsed-badge--active" : ""}`}>
                      {formatElapsed(a.started_at, a.completed_at)}
                    </span>
                  </td>
                  <td className="td-date">
                    {new Date(a.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {a.status === "completed" && (
                      <button
                        onClick={() => handleExport(a.id)}
                        className="btn btn--sm btn--ghost"
                        title="Export CSV"
                      >
                        <Download size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
