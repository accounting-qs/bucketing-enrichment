"use client";

import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Plus,
  Trash2,
  Save,
  Key,
  Layers,
} from "lucide-react";
import { DEFAULT_TAXONOMY } from "@/lib/defaultTaxonomy";

interface CustomBucket {
  id: string;
  bucket_name: string;
  description: string;
  direct_ancestor: string;
  root_category: string;
}

export default function SettingsPage() {
  const [customBuckets, setCustomBuckets] = useState<CustomBucket[]>([]);
  const [showAddBucket, setShowAddBucket] = useState(false);
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

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">
            <SettingsIcon size={28} className="page__title-icon" />
            Settings
          </h1>
          <p className="page__subtitle">
            Configure AI providers and manage taxonomy
          </p>
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
            Contact your administrator or update the Render environment variables.
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

      {/* Taxonomy */}
      <section className="card settings-section">
        <div className="card__header">
          <h2 className="card__title">
            <Layers size={18} /> Industry Taxonomy
          </h2>
          <button
            onClick={() => setShowAddBucket(true)}
            className="btn btn--sm btn--primary"
          >
            <Plus size={14} /> Add Bucket
          </button>
        </div>
        <div className="card__body">
          <h3 className="settings-subtitle">
            Default Buckets ({DEFAULT_TAXONOMY.length})
          </h3>
          <div className="taxonomy-grid">
            {DEFAULT_TAXONOMY.map((b) => (
              <div key={b.bucket_name} className="taxonomy-item">
                <span className="taxonomy-item__name">{b.bucket_name}</span>
                <span className="taxonomy-item__ancestor">
                  {b.root_category} → {b.direct_ancestor}
                </span>
              </div>
            ))}
          </div>

          {customBuckets.length > 0 && (
            <>
              <h3 className="settings-subtitle" style={{ marginTop: "1.5rem" }}>
                Custom Buckets ({customBuckets.length})
              </h3>
              <div className="taxonomy-grid">
                {customBuckets.map((b) => (
                  <div key={b.id} className="taxonomy-item taxonomy-item--custom">
                    <div className="taxonomy-item__content">
                      <span className="taxonomy-item__name">{b.bucket_name}</span>
                      <span className="taxonomy-item__ancestor">
                        {b.root_category} → {b.direct_ancestor}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteBucket(b.id)}
                      className="btn-icon btn-icon--danger"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Add Bucket Modal */}
          {showAddBucket && (
            <div className="modal-overlay" onClick={() => setShowAddBucket(false)}>
              <div className="modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="modal__title">Add Custom Bucket</h2>
                <div className="modal__body">
                  <label className="form-label">
                    Bucket Name *
                    <input
                      type="text"
                      value={newBucket.bucket_name}
                      onChange={(e) => setNewBucket({ ...newBucket, bucket_name: e.target.value })}
                      className="form-input"
                      placeholder="e.g., Healthcare Technology"
                    />
                  </label>
                  <label className="form-label">
                    Description
                    <input
                      type="text"
                      value={newBucket.description}
                      onChange={(e) => setNewBucket({ ...newBucket, description: e.target.value })}
                      className="form-input"
                      placeholder="Brief description"
                    />
                  </label>
                  <label className="form-label">
                    Parent Category (Direct Ancestor)
                    <input
                      type="text"
                      value={newBucket.direct_ancestor}
                      onChange={(e) => setNewBucket({ ...newBucket, direct_ancestor: e.target.value })}
                      className="form-input"
                      placeholder="e.g., Technology & Software"
                    />
                  </label>
                  <label className="form-label">
                    Root Category
                    <input
                      type="text"
                      value={newBucket.root_category}
                      onChange={(e) => setNewBucket({ ...newBucket, root_category: e.target.value })}
                      className="form-input"
                      placeholder="e.g., SaaS / Software"
                    />
                  </label>
                </div>
                <div className="modal__footer">
                  <button onClick={() => setShowAddBucket(false)} className="btn btn--ghost">Cancel</button>
                  <button onClick={addBucket} disabled={!newBucket.bucket_name.trim() || saving} className="btn btn--primary">
                    {saving ? "Saving..." : "Add Bucket"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
