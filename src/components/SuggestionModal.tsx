"use client";

import { useState } from "react";
import { X, Check, Target, Layers, ArrowRight, AlertTriangle, ShieldCheck } from "lucide-react";

export interface SuggestedBucket {
    name: string;
    description: string;
    match: string[];
    count: number;
    type: "parent" | "sub";
    parentSuggested?: string;
}

export default function SuggestionModal({
    suggestions,
    onConfirm,
    onDeny
}: {
    suggestions: SuggestedBucket[];
    onConfirm: (approved: SuggestedBucket[]) => void;
    onDeny: () => void;
}) {
    const [selected, setSelected] = useState<Record<string, boolean>>(
        suggestions.reduce((acc, s) => ({ ...acc, [s.name]: true }), {})
    );

    const toggle = (name: string) => {
        setSelected(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const handleApprove = () => {
        const approved = suggestions.filter(s => selected[s.name]);
        onConfirm(approved);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
                <header className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-zinc-900/50">
                    <div className="space-y-1">
                        <h2 className="text-2xl font-display font-bold flex items-center gap-3">
                            <ShieldCheck className="w-7 h-7 text-primary" />
                            Niche Discovery Detected
                        </h2>
                        <p className="text-slate-500 font-medium">The AI found significant industry segments not present in your taxonomy guide.</p>
                    </div>
                    <button onClick={onDeny} className="p-2 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {suggestions.map((s) => (
                            <div
                                key={s.name}
                                onClick={() => toggle(s.name)}
                                className={`group p-5 rounded-2xl border-2 transition-all cursor-pointer relative overflow-hidden ${selected[s.name]
                                        ? "border-primary bg-primary/5 shadow-md shadow-primary/5"
                                        : "border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-transparent grayscale opacity-60"
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-3 relative z-10">
                                    <div className="flex items-center gap-2">
                                        {s.type === 'parent' ? <Layers className="w-4 h-4 text-primary" /> : <Target className="w-4 h-4 text-amber-500" />}
                                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            {s.type === 'parent' ? 'Parent Cluster' : 'Sub-Segment'}
                                        </span>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${selected[s.name] ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-zinc-800 text-transparent'}`}>
                                        <Check className="w-4 h-4" />
                                    </div>
                                </div>

                                <h4 className="font-bold text-lg mb-1">{s.name}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                    {s.description}
                                </p>

                                <div className="mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-display font-bold">{s.count}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Records</span>
                                    </div>
                                    {s.parentSuggested && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold bg-slate-200 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                                            <span className="text-slate-400">Parent:</span>
                                            <span className="truncate max-w-[80px]">{s.parentSuggested}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/50 dark:border-amber-900/50 flex gap-4">
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-amber-900 dark:text-amber-400 uppercase tracking-wide">Data Policy Reminder</p>
                            <p className="text-xs text-amber-800/70 dark:text-amber-500/70 leading-relaxed">
                                Denied suggestions will be automatically routed to the **"General / Unformatted"** bucket. Approved buckets will be integrated into this specific analysis hierarchy.
                            </p>
                        </div>
                    </div>
                </div>

                <footer className="p-8 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="text-sm font-medium text-slate-500">
                        Selected <span className="text-primary font-bold">{Object.values(selected).filter(Boolean).length}</span> of {suggestions.length} suggested niches
                    </div>
                    <div className="flex gap-4 w-full md:w-auto">
                        <button
                            onClick={onDeny}
                            className="flex-1 md:px-8 py-3.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-zinc-800 transition-all active:scale-[0.98]"
                        >
                            Deny All (Send to General)
                        </button>
                        <button
                            onClick={handleApprove}
                            className="flex-1 md:px-10 py-3.5 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                        >
                            Approve & Finalize
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}
