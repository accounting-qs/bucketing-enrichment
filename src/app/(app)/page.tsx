"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  TrendingUp,
  FileSpreadsheet,
  Activity,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface DashboardStats {
  totalProjects: number;
  totalWorkbooks: number;
  totalAnalyses: number;
  totalRowsProcessed: number;
  avgConfidence: number | null;
  bucketDistribution: Record<string, number>;
  recentAnalyses: Array<{
    id: string;
    project_name: string;
    workbook_filename: string;
    status: string;
    total_rows: number;
    total_rows_processed: number;
    ai_provider: string;
    created_at: string;
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats/dashboard")
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    {
      label: "Total Projects",
      value: stats?.totalProjects ?? 0,
      icon: FolderOpen,
      color: "var(--accent-blue)",
    },
    {
      label: "Files Uploaded",
      value: stats?.totalWorkbooks ?? 0,
      icon: FileSpreadsheet,
      color: "var(--accent-green)",
    },
    {
      label: "Analyses Completed",
      value: stats?.totalAnalyses ?? 0,
      icon: Activity,
      color: "var(--accent-purple)",
    },
    {
      label: "Rows Processed",
      value: stats?.totalRowsProcessed?.toLocaleString() ?? "0",
      icon: TrendingUp,
      color: "var(--accent-orange)",
    },
  ];

  // Top 10 buckets by count
  const topBuckets = stats?.bucketDistribution
    ? Object.entries(stats.bucketDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    : [];

  const maxBucketCount = topBuckets.length > 0 ? topBuckets[0][1] : 1;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">
            <Sparkles size={28} className="page__title-icon" />
            Dashboard
          </h1>
          <p className="page__subtitle">
            Overview of your lead enrichment pipeline
          </p>
        </div>
        <Link href="/projects" className="btn btn--primary">
          <Plus size={18} />
          New Project
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card">
              <div className="stat-card__icon" style={{ backgroundColor: card.color + "18", color: card.color }}>
                <Icon size={22} />
              </div>
              <div className="stat-card__content">
                <span className="stat-card__value">
                  {loading ? "—" : card.value}
                </span>
                <span className="stat-card__label">{card.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        {/* Bucket Distribution */}
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Bucket Distribution</h2>
            {stats?.avgConfidence && (
              <span className="badge badge--info">
                Avg. Confidence: {(stats.avgConfidence * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <div className="card__body">
            {topBuckets.length === 0 ? (
              <div className="empty-state">
                <p>No analyses completed yet. Run your first analysis to see distribution.</p>
              </div>
            ) : (
              <div className="bucket-bars">
                {topBuckets.map(([name, count]) => (
                  <div key={name} className="bucket-bar">
                    <div className="bucket-bar__label">
                      <span className="bucket-bar__name">{name}</span>
                      <span className="bucket-bar__count">{count.toLocaleString()}</span>
                    </div>
                    <div className="bucket-bar__track">
                      <div
                        className="bucket-bar__fill"
                        style={{ width: `${(count / maxBucketCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Recent Analyses */}
        <section className="card">
          <div className="card__header">
            <h2 className="card__title">Recent Analyses</h2>
            <Link href="/history" className="card__action">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card__body">
            {!stats?.recentAnalyses?.length ? (
              <div className="empty-state">
                <p>No analyses yet. Create a project and upload a CSV to get started.</p>
              </div>
            ) : (
              <div className="activity-list">
                {stats.recentAnalyses.map((a) => (
                  <div key={a.id} className="activity-item">
                    <div className="activity-item__info">
                      <span className="activity-item__project">{a.project_name}</span>
                      <span className="activity-item__file">{a.workbook_filename}</span>
                    </div>
                    <div className="activity-item__meta">
                      <span className={`status-badge status-badge--${a.status}`}>
                        {a.status}
                      </span>
                      <span className="activity-item__rows">
                        {a.total_rows_processed?.toLocaleString()} rows
                      </span>
                      <span className="activity-item__date">
                        {new Date(a.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
