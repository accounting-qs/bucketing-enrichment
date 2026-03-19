"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Cpu,
  DollarSign,
  Clock,
  Rows3,
  Filter,
  Zap,
  Brain,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

interface AIModel {
  id: string;
  name: string;
  provider: "openai" | "gemini" | "claude" | "openrouter";
  inputPrice: number | null;
  outputPrice: number | null;
  isFree: boolean;
  contextWindow: number;
}

export type AnalysisMode = "ai_only" | "deterministic_only" | "deterministic_then_ai" | "ai_then_deterministic";

export interface AnalysisConfig {
  model: AIModel | null;
  column: string;
  rowLimit: number | null; // null = all rows
  minBucketThreshold: number;
  analysisMode: AnalysisMode;
}

interface Props {
  columns: string[];
  totalRows: number;
  onRunAnalysis: (config: AnalysisConfig) => void;
  disabled?: boolean;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  gemini: "Google Gemini",
  claude: "Anthropic Claude",
  openrouter: "OpenRouter",
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  gemini: "#4285f4",
  claude: "#d97706",
  openrouter: "#8b5cf6",
};

const MODE_OPTIONS: { value: AnalysisMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "ai_only", label: "AI Only", icon: <Brain size={14} />, desc: "Standard AI classification" },
  { value: "deterministic_only", label: "Deterministic", icon: <Zap size={14} />, desc: "Keyword matching — instant & free" },
  { value: "deterministic_then_ai", label: "Determ. → AI", icon: <Sparkles size={14} />, desc: "Keywords first, AI reviews uncertain" },
  { value: "ai_then_deterministic", label: "AI → Determ.", icon: <Cpu size={14} />, desc: "AI first, keywords validate results" },
];

export default function AnalysisConfigPanel({ columns, totalRows, onRunAnalysis, disabled }: Props) {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [selectedModel, setSelectedModel] = useState<AIModel | null>(null);
  const [column, setColumn] = useState("");
  const [useCustomRows, setUseCustomRows] = useState(false);
  const [rowLimit, setRowLimit] = useState<number>(totalRows);
  const [minBucketThreshold, setMinBucketThreshold] = useState(5);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("ai_only");
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Fetch models on mount
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        setModels(data.models || []);
        // Default to first gemini model
        const defaultModel = (data.models || []).find((m: AIModel) => m.provider === "gemini");
        if (defaultModel) setSelectedModel(defaultModel);
      })
      .catch(console.error)
      .finally(() => setLoadingModels(false));
  }, []);

  // Group models by provider
  const modelsByProvider = useMemo(() => {
    const groups: Record<string, AIModel[]> = {};
    for (const m of models) {
      if (!groups[m.provider]) groups[m.provider] = [];
      groups[m.provider].push(m);
    }
    return groups;
  }, [models]);

  // Cost estimate
  const effectiveRows = useCustomRows ? Math.min(rowLimit, totalRows) : totalRows;
  const isDeterministicOnly = analysisMode === "deterministic_only";

  const estimate = useMemo(() => {
    if (isDeterministicOnly || !selectedModel) {
      return { cost: 0, time: effectiveRows > 0 ? 0.1 : 0, costPerRow: 0 };
    }
    const avgTokensPerRow = 200;
    const outputTokensPerRow = 80;
    const inputCost = (selectedModel.inputPrice || 0) * (effectiveRows * avgTokensPerRow) / 1_000_000;
    const outputCost = (selectedModel.outputPrice || 0) * (effectiveRows * outputTokensPerRow) / 1_000_000;
    const cost = inputCost + outputCost;
    // Hybrid modes: AI processes ~60% of rows on average
    const aiRows = analysisMode.includes("deterministic") ? Math.ceil(effectiveRows * 0.6) : effectiveRows;
    const time = (aiRows / 25) * 2 / 60;
    return { cost, time, costPerRow: effectiveRows > 0 ? cost / effectiveRows : 0 };
  }, [selectedModel, effectiveRows, isDeterministicOnly, analysisMode]);

  const canRun = column && (isDeterministicOnly || selectedModel) && effectiveRows > 0;

  const handleRun = () => {
    if (!canRun) return;
    onRunAnalysis({
      model: isDeterministicOnly ? null : selectedModel,
      column,
      rowLimit: useCustomRows ? rowLimit : null,
      minBucketThreshold,
      analysisMode,
    });
  };

  return (
    <div className="config-panel">
      <div className="config-panel__header">
        <h3 className="config-panel__title">
          <Cpu size={18} /> Configure Analysis
        </h3>
      </div>

      <div className="config-panel__body">
        {/* Column Selection */}
        <label className="form-label">
          Select Column *
          <select
            value={column}
            onChange={(e) => setColumn(e.target.value)}
            className="form-input"
          >
            <option value="">Choose column to analyze...</option>
            {columns.map((col) => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </label>

        {/* Analysis Mode */}
        <div className="config-section">
          <label className="config-section__label">Analysis Mode</label>
          <div className="mode-selector">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`mode-option ${analysisMode === opt.value ? "mode-option--active" : ""}`}
                onClick={() => setAnalysisMode(opt.value)}
                title={opt.desc}
              >
                {opt.icon}
                <span className="mode-option__label">{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="config-hint">
            {MODE_OPTIONS.find((o) => o.value === analysisMode)?.desc}
          </p>
        </div>

        {/* Model Selection (hidden if deterministic only) */}
        {!isDeterministicOnly && (
          <div className="config-section">
            <label className="config-section__label">AI Model</label>
            {loadingModels ? (
              <div className="config-loading">Loading models...</div>
            ) : (
              <>
                <button
                  className="model-picker-trigger"
                  onClick={() => setShowModelPicker(!showModelPicker)}
                >
                  {selectedModel ? (
                    <div className="model-picker-trigger__selected">
                      <span
                        className="provider-dot"
                        style={{ background: PROVIDER_COLORS[selectedModel.provider] }}
                      />
                      <span className="model-picker-trigger__name">{selectedModel.name}</span>
                      <span className="model-picker-trigger__price">
                        {selectedModel.isFree
                          ? "Free"
                          : `$${selectedModel.inputPrice?.toFixed(2)} / $${selectedModel.outputPrice?.toFixed(2)} per 1M`}
                      </span>
                    </div>
                  ) : (
                    <span>Select a model...</span>
                  )}
                  {showModelPicker ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showModelPicker && (
                  <div className="model-picker">
                    {Object.entries(modelsByProvider).map(([provider, provModels]) => (
                      <div key={provider} className="model-group">
                        <button
                          className="model-group__header"
                          onClick={() => setExpandedProvider(expandedProvider === provider ? null : provider)}
                        >
                          <span
                            className="provider-dot"
                            style={{ background: PROVIDER_COLORS[provider] }}
                          />
                          <span className="model-group__name">{PROVIDER_LABELS[provider] || provider}</span>
                          <span className="model-group__count">{provModels.length} models</span>
                          {expandedProvider === provider ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {expandedProvider === provider && (
                          <div className="model-group__list">
                            {provModels.map((m) => (
                              <button
                                key={m.id}
                                className={`model-item ${selectedModel?.id === m.id ? "model-item--active" : ""}`}
                                onClick={() => {
                                  setSelectedModel(m);
                                  setShowModelPicker(false);
                                }}
                              >
                                <span className="model-item__name">{m.name}</span>
                                <span className="model-item__price">
                                  {m.isFree ? (
                                    <span className="free-badge">Free</span>
                                  ) : (
                                    <>
                                      <span className="price-in">${m.inputPrice?.toFixed(2)}</span>
                                      <span className="price-sep">/</span>
                                      <span className="price-out">${m.outputPrice?.toFixed(2)}</span>
                                      <span className="price-unit">per 1M tok</span>
                                    </>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Row Limit */}
        <div className="config-section">
          <label className="config-section__label">
            <Rows3 size={14} /> Row Limit
          </label>
          <div className="row-limit">
            <label className="row-limit__toggle">
              <input
                type="checkbox"
                checked={useCustomRows}
                onChange={(e) => setUseCustomRows(e.target.checked)}
              />
              <span>Custom row count</span>
            </label>
            {useCustomRows ? (
              <div className="row-limit__input-wrap">
                <input
                  type="number"
                  value={rowLimit}
                  onChange={(e) => setRowLimit(Math.max(1, Math.min(totalRows, parseInt(e.target.value) || 1)))}
                  className="form-input form-input--sm"
                  min={1}
                  max={totalRows}
                />
                <span className="row-limit__of">of {totalRows.toLocaleString()} rows</span>
              </div>
            ) : (
              <span className="config-hint">All {totalRows.toLocaleString()} rows</span>
            )}
          </div>
        </div>

        {/* Min Bucket Threshold */}
        <div className="config-section">
          <label className="config-section__label">
            <Filter size={14} /> Min. Bucket Threshold
          </label>
          <div className="threshold-input">
            <input
              type="number"
              value={minBucketThreshold}
              onChange={(e) => setMinBucketThreshold(Math.max(1, parseInt(e.target.value) || 1))}
              className="form-input form-input--sm"
              min={1}
            />
            <span className="config-hint">
              Buckets with fewer than {minBucketThreshold} contacts → General Industry
            </span>
          </div>
        </div>

        {/* Cost Estimate */}
        <div className="estimate-panel">
          <div className="estimate-panel__header">
            <DollarSign size={14} /> Cost & Time Estimate
          </div>
          <div className="estimate-grid">
            <div className="estimate-item">
              <span className="estimate-item__value">
                {isDeterministicOnly ? "Free" : estimate.cost < 0.01 ? `$${estimate.cost.toFixed(4)}` : `$${estimate.cost.toFixed(2)}`}
              </span>
              <span className="estimate-item__label">Estimated Cost</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-item__value">
                {isDeterministicOnly ? "< 1s" : estimate.time < 1 ? `~${Math.ceil(estimate.time * 60)}s` : `~${Math.ceil(estimate.time)} min`}
              </span>
              <span className="estimate-item__label">Estimated Time</span>
            </div>
            <div className="estimate-item">
              <span className="estimate-item__value">
                {isDeterministicOnly ? "$0" : estimate.costPerRow < 0.0001 ? `$${estimate.costPerRow.toFixed(6)}` : `$${estimate.costPerRow.toFixed(4)}`}
              </span>
              <span className="estimate-item__label">Cost per Row</span>
            </div>
          </div>
          {isDeterministicOnly && (
            <p className="estimate-note">
              <AlertCircle size={12} /> Deterministic mode uses keyword matching — no API calls, no cost.
            </p>
          )}
        </div>

        {/* Run Button */}
        <button
          onClick={handleRun}
          disabled={!canRun || disabled}
          className="btn btn--primary btn--lg config-run-btn"
        >
          {disabled ? (
            <>Analyzing...</>
          ) : (
            <>
              <Sparkles size={18} />
              Run Analysis ({effectiveRows.toLocaleString()} rows)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
