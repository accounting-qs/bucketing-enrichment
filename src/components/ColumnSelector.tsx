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
    onAnalyze: (column: string, provider: string) => void;
    onReset: () => void;
}) {
    const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
    const [samples, setSamples] = useState<Array<{ value: string; count: number }>>([]);
    const [isLoadingSamples, setIsLoadingSamples] = useState(false);

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
                    <div className="flex-1 space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">AI Processor</label>
                        <select
                            id="provider-select"
                            className="w-full bg-slate-100 dark:bg-zinc-900 border-2 border-transparent focus:border-primary rounded-xl px-5 py-3.5 text-sm font-bold outline-none cursor-pointer transition-all"
                        >
                            <option value="none">Deterministic (No AI)</option>
                            <option value="claude">Anthropic Claude 4.6 (SOTA Agent)</option>
                            <option value="gemini">Google Gemini 3 (Ultra Flash)</option>
                            <option value="openai">OpenAI GPT-5.3 (Codex Max)</option>
                        </select>
                    </div>

                    <div className="flex items-end flex-1 lg:flex-[0.4]">
                        <button
                            disabled={!selectedColumn}
                            onClick={() => {
                                const prov = (document.getElementById("provider-select") as HTMLSelectElement).value;
                                onAnalyze(selectedColumn!, prov);
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
