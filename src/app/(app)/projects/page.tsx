"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FolderOpen,
  FileSpreadsheet,
  Activity,
  MoreVertical,
  Search,
  Archive,
  Trash2,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  workbook_count?: number;
  analysis_count?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchProjects = () => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const createProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc }),
      });
      if (res.ok) {
        setNewName("");
        setNewDesc("");
        setShowCreateModal(false);
        fetchProjects();
      } else {
        const data = await res.json().catch(() => ({}));
        setCreateError(data.details || data.error || `Server error (${res.status}). Please try again.`);
      }
    } catch (err) {
      setCreateError("Network error. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project and all its data?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    fetchProjects();
  };

  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">
            <FolderOpen size={28} className="page__title-icon" />
            Projects
          </h1>
          <p className="page__subtitle">
            Manage your lead enrichment projects
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn--primary"
        >
          <Plus size={18} />
          New Project
        </button>
      </div>

      {/* Search */}
      <div className="search-bar">
        <Search size={18} className="search-bar__icon" />
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-bar__input"
        />
      </div>

      {/* Project Grid */}
      {loading ? (
        <div className="loading-state">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state empty-state--large">
          <FolderOpen size={48} className="empty-state__icon" />
          <h3>No projects yet</h3>
          <p>Create your first project to start enriching leads.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn--primary"
          >
            <Plus size={18} />
            Create Project
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {filtered.map((project) => (
            <div key={project.id} className="project-card">
              <div className="project-card__header">
                <Link
                  href={`/projects/${project.id}`}
                  className="project-card__title"
                >
                  {project.name}
                </Link>
                <div className="project-card__actions">
                  <span className={`status-badge status-badge--${project.status}`}>
                    {project.status}
                  </span>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="btn-icon btn-icon--danger"
                    title="Delete project"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {project.description && (
                <p className="project-card__desc">{project.description}</p>
              )}
              <div className="project-card__stats">
                <span>
                  <FileSpreadsheet size={14} />
                  {project.workbook_count ?? 0} files
                </span>
                <span>
                  <Activity size={14} />
                  {project.analysis_count ?? 0} analyses
                </span>
              </div>
              <div className="project-card__footer">
                <span className="project-card__date">
                  Created {new Date(project.created_at).toLocaleDateString()}
                </span>
                <Link
                  href={`/projects/${project.id}`}
                  className="btn btn--sm btn--ghost"
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => { setShowCreateModal(false); setCreateError(null); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Create New Project</h2>
            <div className="modal__body">
              <label className="form-label">
                Project Name *
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g., Q1 2026 Lead Enrichment"
                  className="form-input"
                  autoFocus
                />
              </label>
              <label className="form-label">
                Description (optional)
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description of this enrichment project"
                  className="form-input form-textarea"
                  rows={3}
                />
              </label>
            </div>
            <div className="modal__footer">
              {createError && (
                <p style={{ color: "var(--color-error, #f87171)", fontSize: "0.8rem", marginBottom: "0.5rem", width: "100%" }}>
                  ⚠ {createError}
                </p>
              )}
              <button
                onClick={() => { setShowCreateModal(false); setCreateError(null); }}
                className="btn btn--ghost"
              >
                Cancel
              </button>
              <button
                onClick={createProject}
                disabled={!newName.trim() || creating}
                className="btn btn--primary"
              >
                {creating ? "Creating..." : "Create Project"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
