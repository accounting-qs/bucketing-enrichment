"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Key,
  Layers,
  ChevronDown,
  ChevronRight,
  Tags,
  AlertTriangle,
  Search,
  X,
} from "lucide-react";
import { DEFAULT_TAXONOMY } from "@/lib/defaultTaxonomy";
import type { BucketDefinition } from "@/types";

interface CustomBucket {
  id: string;
  bucket_name: string;
  description: string;
  direct_ancestor: string;
  root_category: string;
}

// Colour palette per parent bucket name
const PARENT_COLORS: Record<string, { accent: string; bg: string; border: string }> = {
  "Technology Services": { accent: "#3b82f6", bg: "rgba(59,130,246,0.07)", border: "rgba(59,130,246,0.25)" },
  "Software & SaaS":    { accent: "#8b5cf6", bg: "rgba(139,92,246,0.07)", border: "rgba(139,92,246,0.25)" },
  "Agencies":           { accent: "#f59e0b", bg: "rgba(245,158,11,0.07)", border: "rgba(245,158,11,0.25)" },
  "Professional & Business Services": { accent: "#06b6d4", bg: "rgba(6,182,212,0.07)", border: "rgba(6,182,212,0.25)" },
  "Financial Services": { accent: "#10b981", bg: "rgba(16,185,129,0.07)", border: "rgba(16,185,129,0.25)" },
  "Real Estate":        { accent: "#f97316", bg: "rgba(249,115,22,0.07)", border: "rgba(249,115,22,0.25)" },
  "Industrial & Operations": { accent: "#6b7280", bg: "rgba(107,114,128,0.07)", border: "rgba(107,114,128,0.25)" },
  "Healthcare":         { accent: "#ef4444", bg: "rgba(239,68,68,0.07)", border: "rgba(239,68,68,0.25)" },
  "Non-Profit / Associations": { accent: "#ec4899", bg: "rgba(236,72,153,0.07)", border: "rgba(236,72,153,0.25)" },
  "General Industry":   { accent: "#94a3b8", bg: "rgba(148,163,184,0.07)", border: "rgba(148,163,184,0.2)" },
};

const PARENT_ICONS: Record<string, string> = {
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

/** Build grouped structure: parent → children → leaves */
function buildTree(taxonomy: BucketDefinition[]) {
  const tree: Record<string, Record<string, BucketDefinition[]>> = {};
  for (const b of taxonomy) {
    const parent = b.root_category || "General Industry";
    const child = b.direct_ancestor || "Other";
    if (!tree[parent]) tree[parent] = {};
    if (!tree[parent][child]) tree[parent][child] = [];
    tree[parent][child].push(b);
  }
  return tree;
}

/** The fallback parent bucket that should always appear last */
const FALLBACK_PARENT = "General Industry";

export default function SettingsPage() {
  const [customBuckets, setCustomBuckets] = useState<CustomBucket[]>([]);
  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});
  const [expandedChildren, setExpandedChildren] = useState<Record<string, boolean>>({});
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [search, setSearch] = useState("");
  const [newBucket, setNewBucket] = useState({
    bucket_name: "",
    description: "",
    direct_ancestor: "",
    root_category: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/taxonomy/custom")
      .then((r) => r.json())
      .then((data) => setCustomBuckets(data.buckets || []))
      .catch(console.error);
  }, []);

  // Build tree from DEFAULT_TAXONOMY
  const tree = useMemo(() => buildTree(DEFAULT_TAXONOMY), []);

  // Get ordered parent list — general always last
  const parents = useMemo(() => {
    const all = Object.keys(tree);
    const non = all.filter((p) => p !== FALLBACK_PARENT);
    return FALLBACK_PARENT in tree ? [...non, FALLBACK_PARENT] : non;
  }, [tree]);

  // Get unique parent categories for the custom bucket dropdown
  const existingParents = useMemo(() => Array.from(new Set(DEFAULT_TAXONOMY.map((b) => b.root_category))), []);
  // Get unique child categories for a selected parent
  const existingChildren = useMemo(() =>
    newBucket.root_category
      ? Array.from(new Set(DEFAULT_TAXONOMY.filter((b) => b.root_category === newBucket.root_category).map((b) => b.direct_ancestor)))
      : [],
  [newBucket.root_category]);

  // Filter taxonomy by search
  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const q = search.toLowerCase();
    const result: Record<string, Record<string, BucketDefinition[]>> = {};
    for (const [parent, children] of Object.entries(tree)) {
      for (const [child, leaves] of Object.entries(children)) {
        const matched = leaves.filter(
          (b) =>
            b.bucket_name.toLowerCase().includes(q) ||
            b.direct_ancestor.toLowerCase().includes(q) ||
            b.root_category.toLowerCase().includes(q) ||
            b.description.toLowerCase().includes(q)
        );
        if (matched.length > 0) {
          if (!result[parent]) result[parent] = {};
          result[parent][child] = matched;
        }
      }
    }
    return result;
  }, [tree, search]);

  const filteredParents = useMemo(() => {
    const all = Object.keys(filteredTree);
    const non = all.filter((p) => p !== FALLBACK_PARENT);
    return FALLBACK_PARENT in filteredTree ? [...non, FALLBACK_PARENT] : non;
  }, [filteredTree]);

  const toggleParent = (p: string) =>
    setExpandedParents((prev) => ({ ...prev, [p]: !prev[p] }));

  const toggleChild = (key: string) =>
    setExpandedChildren((prev) => ({ ...prev, [key]: !prev[key] }));

  // Expand all matches when searching
  useEffect(() => {
    if (!search.trim()) return;
    const newP: Record<string, boolean> = {};
    const newC: Record<string, boolean> = {};
    for (const [parent, children] of Object.entries(filteredTree)) {
      newP[parent] = true;
      for (const child of Object.keys(children)) {
        newC[`${parent}::${child}`] = true;
      }
    }
    setExpandedParents(newP);
    setExpandedChildren(newC);
  }, [search, filteredTree]);

  const addBucket = async () => {
    if (!newBucket.bucket_name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/taxonomy/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBucket),
      });
      if (res.ok) {
        const data = await res.json();
        setCustomBuckets((prev) => [...prev, data.bucket]);
        setNewBucket({ bucket_name: "", description: "", direct_ancestor: "", root_category: "" });
        setShowAddBucket(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteBucket = async (id: string) => {
    if (!confirm("Remove this custom bucket?")) return;
    await fetch(`/api/taxonomy/custom/${id}`, { method: "DELETE" });
    setCustomBuckets((prev) => prev.filter((b) => b.id !== id));
  };

  const totalLeaves = DEFAULT_TAXONOMY.length;

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">
            <SettingsIcon size={28} className="page__title-icon" />
            Settings
          </h1>
          <p className="page__subtitle">Configure AI providers and manage taxonomy</p>
        </div>
      </div>

      {/* API Keys */}
      <section className="card settings-section">
        <div className="card__header">
          <h2 className="card__title">
            <Key size={18} /> AI Provider API Keys
          </h2>
        </div>
        <div className="card__body">
          <p className="settings-note">
            API keys are configured via environment variables on the server.
          </p>
          <div className="provider-list">
            {[
              { name: "Gemini", env: "GEMINI_API_KEY" },
              { name: "OpenAI", env: "OPENAI_API_KEY" },
              { name: "Claude", env: "ANTHROPIC_API_KEY" },
              { name: "OpenRouter", env: "OPENROUTER_API_KEY" },
            ].map((p) => (
              <div key={p.name} className="provider-item">
                <span className="provider-item__name">{p.name}</span>
                <span className="provider-item__env">{p.env}</span>
                <span className="status-badge status-badge--active">Configured</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Taxonomy Explorer */}
      <section className="card settings-section">
        <div className="card__header">
          <h2 className="card__title">
            <Layers size={18} /> Industry Taxonomy
            <span className="taxonomy-count-badge">{totalLeaves} buckets</span>
          </h2>
          <button onClick={() => setShowAddBucket(true)} className="btn btn--sm btn--primary">
            <Plus size={14} /> Add Bucket
          </button>
        </div>

        <div className="card__body" style={{ padding: "12px 20px" }}>
          {/* Search */}
          <div className="taxonomy-search">
            <Search size={14} className="taxonomy-search__icon" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search buckets, categories, or descriptions…"
              className="taxonomy-search__input"
            />
            {search && (
              <button className="taxonomy-search__clear" onClick={() => setSearch("")}>
                <X size={14} />
              </button>
            )}
          </div>

          {/* Hierarchy legend */}
          <div className="taxonomy-legend">
            <span className="taxonomy-legend__item">
              <span className="taxonomy-legend__dot taxonomy-legend__dot--parent" />
              Parent (industry)
            </span>
            <span className="taxonomy-legend__item">
              <span className="taxonomy-legend__dot taxonomy-legend__dot--child" />
              Child (segment)
            </span>
            <span className="taxonomy-legend__item">
              <span className="taxonomy-legend__dot taxonomy-legend__dot--leaf" />
              Leaf (bucket)
            </span>
          </div>

          {/* Tree */}
          <div className="taxonomy-tree">
            {filteredParents.map((parent) => {
              const childMap = filteredTree[parent] || {};
              const color = PARENT_COLORS[parent] || PARENT_COLORS["General Industry"];
              const icon = PARENT_ICONS[parent] || "📁";
              const isOpen = expandedParents[parent] ?? false;
              const isFallback = parent === FALLBACK_PARENT;
              const leafCount = Object.values(childMap).reduce((s, ls) => s + ls.length, 0);
              const childCount = Object.keys(childMap).length;

              return (
                <div
                  key={parent}
                  className={`taxo-parent ${isFallback ? "taxo-parent--fallback" : ""}`}
                  style={{ borderColor: color.border }}
                >
                  {/* Parent row */}
                  <button
                    className="taxo-parent__header"
                    onClick={() => toggleParent(parent)}
                    style={{ background: color.bg }}
                  >
                    <span className="taxo-parent__chevron" style={{ transform: isOpen ? "rotate(90deg)" : "none" }}>
                      <ChevronRight size={15} />
                    </span>
                    <span className="taxo-parent__icon">{icon}</span>
                    <span className="taxo-parent__name" style={{ color: color.accent }}>{parent}</span>
                    <span className="taxo-parent__meta">
                      <span className="taxo-badge taxo-badge--children">{childCount} segments</span>
                      <span className="taxo-badge taxo-badge--leaves">{leafCount} buckets</span>
                    </span>
                  </button>

                  {/* Children */}
                  {isOpen && (
                    <div className="taxo-children">
                      {Object.entries(childMap).map(([child, leaves]) => {
                        const childKey = `${parent}::${child}`;
                        const isChildOpen = expandedChildren[childKey] ?? false;

                        return (
                          <div key={child} className="taxo-child">
                            {/* Child row */}
                            <button
                              className="taxo-child__header"
                              onClick={() => toggleChild(childKey)}
                            >
                              <span
                                className="taxo-child__chevron"
                                style={{ transform: isChildOpen ? "rotate(90deg)" : "none" }}
                              >
                                <ChevronRight size={13} />
                              </span>
                              <span className="taxo-child__name">{child}</span>
                              <span className="taxo-child__count">{leaves.length}</span>
                            </button>

                            {/* Leaf buckets */}
                            {isChildOpen && (
                              <div className="taxo-leaves">
                                {leaves.map((b) => (
                                  <div key={b.bucket_name} className="taxo-leaf">
                                    <div className="taxo-leaf__header">
                                      <span
                                        className="taxo-leaf__dot"
                                        style={{ background: color.accent }}
                                      />
                                      <span className="taxo-leaf__name">{b.bucket_name}</span>
                                      <span className="taxo-leaf__kw">{b.include.length} keywords</span>
                                    </div>
                                    <p className="taxo-leaf__desc">{b.description}</p>
                                    {b.example_strings.length > 0 && (
                                      <div className="taxo-leaf__examples">
                                        {b.example_strings.slice(0, 2).map((ex) => (
                                          <span key={ex} className="taxo-leaf__example">
                                            "{ex}"
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom Buckets */}
          {customBuckets.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 className="settings-subtitle" style={{ marginBottom: 12 }}>
                <Tags size={14} style={{ display: "inline", marginRight: 6 }} />
                Custom Buckets ({customBuckets.length})
              </h3>
              <div className="taxonomy-grid">
                {customBuckets.map((b) => (
                  <div key={b.id} className="taxonomy-item taxonomy-item--custom">
                    <div className="taxonomy-item__content">
                      <span className="taxonomy-item__name">{b.bucket_name}</span>
                      <span className="taxonomy-item__ancestor">
                        {b.root_category || "—"} → {b.direct_ancestor || "—"}
                      </span>
                    </div>
                    <button onClick={() => deleteBucket(b.id)} className="btn-icon btn-icon--danger">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Add Bucket Modal */}
      {showAddBucket && (
        <div className="modal-overlay" onClick={() => setShowAddBucket(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal__title">Add Custom Bucket</h2>
            <div className="modal__body">
              <p style={{ fontSize: "0.8rem", color: "#64748b", marginBottom: 16 }}>
                Custom buckets extend the default taxonomy. Assign them to an existing parent and child to keep classification consistent.
              </p>

              <label className="form-label">
                Bucket Name (sub_child_bucket) *
                <input
                  type="text"
                  value={newBucket.bucket_name}
                  onChange={(e) => setNewBucket({ ...newBucket, bucket_name: e.target.value })}
                  className="form-input"
                  placeholder="e.g., Legal Tech SaaS"
                />
              </label>

              <label className="form-label">
                Description
                <input
                  type="text"
                  value={newBucket.description}
                  onChange={(e) => setNewBucket({ ...newBucket, description: e.target.value })}
                  className="form-input"
                  placeholder="Brief description of this bucket"
                />
              </label>

              <label className="form-label">
                Parent Bucket (root_category)
                <select
                  value={newBucket.root_category}
                  onChange={(e) =>
                    setNewBucket({ ...newBucket, root_category: e.target.value, direct_ancestor: "" })
                  }
                  className="form-input"
                >
                  <option value="">Select a parent…</option>
                  {existingParents.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                  <option value="__new__">+ New parent category</option>
                </select>
              </label>

              {newBucket.root_category === "__new__" && (
                <label className="form-label">
                  New Parent Name
                  <input
                    type="text"
                    value=""
                    onChange={(e) => setNewBucket({ ...newBucket, root_category: e.target.value })}
                    className="form-input"
                    placeholder="e.g., Education"
                  />
                </label>
              )}

              <label className="form-label">
                Child Segment (direct_ancestor)
                {existingChildren.length > 0 ? (
                  <select
                    value={newBucket.direct_ancestor}
                    onChange={(e) => setNewBucket({ ...newBucket, direct_ancestor: e.target.value })}
                    className="form-input"
                  >
                    <option value="">Select a child segment…</option>
                    {existingChildren.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                    <option value="__new__">+ New child segment</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={newBucket.direct_ancestor}
                    onChange={(e) => setNewBucket({ ...newBucket, direct_ancestor: e.target.value })}
                    className="form-input"
                    placeholder="e.g., EdTech"
                  />
                )}
              </label>

              {newBucket.direct_ancestor === "__new__" && (
                <label className="form-label">
                  New Child Segment Name
                  <input
                    type="text"
                    value=""
                    onChange={(e) => setNewBucket({ ...newBucket, direct_ancestor: e.target.value })}
                    className="form-input"
                    placeholder="e.g., EdTech"
                  />
                </label>
              )}

              <div
                style={{
                  padding: "10px 14px",
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 8,
                  fontSize: "0.78rem",
                  color: "#92400e",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                }}
              >
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                Custom buckets do not include keyword matching — they rely on AI classification only.
                Use Settings to also define include/exclude terms if needed.
              </div>
            </div>
            <div className="modal__footer">
              <button onClick={() => setShowAddBucket(false)} className="btn btn--ghost">
                Cancel
              </button>
              <button
                onClick={addBucket}
                disabled={!newBucket.bucket_name.trim() || saving}
                className="btn btn--primary"
              >
                {saving ? "Saving…" : "Add Bucket"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
