"use client";

import { Workbook } from "@/types";
import { ChevronRight, Database, Play, RotateCcw, Fingerprint, Info } from "lucide-react";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";


function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function ColumnSelector({
    workbook,
    onAnalyze,
    onReset
}: {
    workbook: Workbook;
    onAnalyze: (column: string, provider: string, minClusterSize: number, maxRowsToProcess: number, customApiKey?: string) => void;
    onReset: () => void;
}) {
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
    const [samples, setSamples] = useState<Array<{ value: string; count: number }>>([]);
    const [isLoadingSamples, setIsLoadingSamples] = useState(false);
    const [minClusterSize, setMinClusterSize] = useState<number>(50);
    const [maxRowsToProcess, setMaxRowsToProcess] = useState<number>(workbook.rowCount);
    const [providerModel, setProviderModel] = useState("anthropic:claude-3-7-sonnet-latest");
    const [customApiKey, setCustomApiKey] = useState("");

    // ETA Calc helpers
    const getBatchTime = (model: string) => {
        if (model.includes("gemini") || model.includes("flash") || model.includes("openrouter")) return 3; // ~3s per batch
        if (model.includes("mini") || model.includes("haiku")) return 4; 
        return 7; // heavier models
    };
    
    // Default batch size is roughly 150 rows.
    const estBatches = Math.ceil(maxRowsToProcess / 150);
    const estTimeSecs = estBatches * (getBatchTime(providerModel) + 1.5); // + rate limit delay
    const etaString = estTimeSecs < 60 ? `${Math.ceil(estTimeSecs)} seconds` : `${(estTimeSecs / 60).toFixed(1)} minutes`;

    const fetchSamples = async (col: string) => {
        setSelectedColumn(col);
        setIsLoadingSamples(true);
        try {
            const res = await fetch(`/api/workbooks/${workbook.id}/sample?column=${encodeURIComponent(col)}`);
            const data = await res.json();
            setSamples(data.samples || []);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoadingSamples(false);
        }
    };

    return (
        <div className="space-y-8 animate-reveal">
            {/* Workbook Header */}
            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-5">
                    <div className="bg-primary/10 p-4 rounded-xl text-primary">
                        <Database className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-display font-bold tracking-tight">{workbook.filename}</h2>
                        <p className="text-sm text-slate-500 font-medium">
                            {workbook.rowCount.toLocaleString()} rows • {workbook.columns.length} columns detected
                        </p>
                    </div>
                </div>
                <button
                    onClick={onReset}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-primary hover:bg-primary/5 transition-all flex items-center gap-2"
                >
                    <RotateCcw className="w-4 h-4" />
                    Replace File
                </button>
            </div>

            <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 p-10 rounded-2xl shadow-sm space-y-10">
                <section className="space-y-6">
                    <div className="space-y-1 text-center">
                        <h3 className="text-2xl font-display font-bold tracking-tight">Identify Enrichment Target</h3>
                        <p className="text-sm text-slate-500 font-medium">Select a dimension to generate hierarchical clusters</p>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {workbook.columns.map((col) => (
                            <button
                                key={col}
                                onClick={() => fetchSamples(col)}
                                className={cn(
                                    "text-left px-5 py-4 rounded-xl border-2 transition-all group relative overflow-hidden",
                                    selectedColumn === col
                                        ? "border-primary bg-primary/5 text-primary"
                                        : "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-zinc-800/50 hover:border-primary/30"
                                )}
                            >
                                <div className="flex items-center justify-between relative z-10">
                                    <span className="truncate pr-2 font-bold text-sm">{col}</span>
                                    <ChevronRight className={cn(
                                        "w-4 h-4 transition-transform",
                                        selectedColumn === col ? "translate-x-1" : "text-slate-400 group-hover:translate-x-1"
                                    )} />
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                {selectedColumn && (
                    <div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 animate-reveal">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Dimension Preview</h4>
                        {isLoadingSamples ? (
                            <div className="flex gap-2 animate-pulse">
                                {[1, 2, 3].map(i => <div key={i} className="h-8 w-24 bg-slate-200 dark:bg-zinc-800 rounded-lg" />)}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {samples.map((s, i) => (
                                    <div key={i} className="px-4 py-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold flex items-center gap-2">
                                        <span className="text-slate-700 dark:text-slate-300">{s.value}</span>
                                        <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">{s.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}


                <div className="flex flex-col lg:flex-row gap-6 pt-8 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex-[1.5] space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">AI Processor</label>
                        <select
                            id="provider-select"
                            value={providerModel}
                            onChange={(e) => setProviderModel(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-zinc-900 border-2 border-transparent focus:border-primary rounded-xl px-5 py-3.5 text-[13px] font-bold outline-none cursor-pointer transition-all"
                        >
                            <option value="none" className="font-semibold text-slate-500">Deterministic (No AI)</option>
                            <optgroup label="Anthropic (Claude)" className="font-bold">
                                <option value="anthropic:claude-3-7-sonnet-latest">Claude 3.7 Sonnet (Latest & Best)</option>
                                <option value="anthropic:claude-3-5-haiku-latest">Claude 3.5 Haiku (Fast)</option>
                                <option value="anthropic:claude-3-opus-latest">Claude 3 Opus (Deep Reasoning)</option>
                            </optgroup>
                            <optgroup label="Google (Gemini)" className="font-bold">
                                <option value="gemini:gemini-3.1-pro">Gemini 3.1 Pro (Latest)</option>
                                <option value="gemini:gemini-3.0-pro">Gemini 3.0 Pro</option>
                                <option value="gemini:gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini:gemini-2.0-flash-lite">Gemini 2.0 Flash Lite</option>
                            </optgroup>
                            <optgroup label="OpenAI (GPT)" className="font-bold">
                                <option value="openai:gpt-4o">GPT-4o</option>
                                <option value="openai:o1">o1 (Thinking Model)</option>
                                <option value="openai:o3-mini">o3-mini</option>
                                <option value="openai:gpt-4o-mini">GPT-4o Mini (Fast)</option>
                            </optgroup>
                            <optgroup label="Open-Source (via OpenRouter.ai)" className="font-bold">
                                <option value="openrouter:meta-llama/llama-3.3-70b-instruct">Meta Llama 3.3 70B</option>
                                <option value="openrouter:google/gemma-2-27b-it">Google Gemma 2 27B</option>
                                <option value="openrouter:minimax/minimax-01">Minimax 01</option>
                                <option value="openrouter:moonshotai/moonshot-v1-8k">Kimi (Moonshot v1)</option>
                                <option value="openrouter:mistralai/mixtral-8x7b-instruct">Mixtral 8x7B</option>
                            </optgroup>
                        </select>
                        {providerModel.startsWith("openrouter") && (
                            <input 
                                type="password" 
                                placeholder="sk-or-v1-..." 
                                value={customApiKey}
                                onChange={(e) => setCustomApiKey(e.target.value)}
                                className="w-full mt-2 bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs outline-none focus:border-primary"
                            />
                        )}
                        <p className="text-[10px] text-slate-400 font-medium ml-1">
                            {providerModel.startsWith('openrouter') ? "Requires a free OpenRouter.ai API Key for open-source inference." : `Estimated Processing Time: ~${etaString}`}
                        </p>
                    </div>

                    <div className="flex-1 space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Rows to Process</label>
                        <input 
                            type="number" 
                            min="1" 
                            max={workbook.rowCount} 
                            value={maxRowsToProcess} 
                            onChange={(e) => setMaxRowsToProcess(Math.min(parseInt(e.target.value) || 0, workbook.rowCount))} 
                            className="w-full bg-slate-100 dark:bg-zinc-900 border-2 border-transparent focus:border-primary rounded-xl px-5 py-3 text-sm font-bold outline-none transition-all" 
                        />
                        <p className="text-[11px] text-slate-400 font-medium ml-1">Out of {workbook.rowCount} total unique values. Remainder will skip AI.</p>
                    </div>

                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 ml-1">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                Auto-Discovery Threshold <Info className="w-4 h-4 text-slate-400" />
                            </label>
                        </div>
                        <input 
                            type="number" 
                            min="1" 
                            max="100000" 
                            value={minClusterSize} 
                            onChange={(e) => setMinClusterSize(parseInt(e.target.value) || 0)} 
                            className="w-full bg-slate-100 dark:bg-zinc-900 border-2 border-transparent focus:border-primary rounded-xl px-5 py-3 text-sm font-bold outline-none transition-all" 
                        />
                        <p className="text-[11px] text-slate-400 font-medium ml-1">Min. unmatched rows required to auto-create a new missing category.</p>
                    </div>

                    <div className="flex items-end flex-1 lg:flex-[0.4]">
                        <button
                            disabled={!selectedColumn}
                            onClick={() => {
                                onAnalyze(selectedColumn!, providerModel, minClusterSize, maxRowsToProcess, customApiKey);
                            }}
                            className="w-full h-full min-h-[56px] bg-primary hover:bg-emerald-600 disabled:opacity-50 disabled:grayscale text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Analyze
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
