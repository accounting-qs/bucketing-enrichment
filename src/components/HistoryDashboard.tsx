"use client";

import { useEffect, useState } from "react";
import { Database, AlertCircle, CheckCircle2, Clock, Play } from "lucide-react";

export default function HistoryDashboard({
    onViewLog
}: {
    onViewLog: (analysisId: string) => void;
}) {
    const [data, setData] = useState<{ analyses: any[], jobs: any[] } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetch('/api/history')
            .then(res => res.json())
            .then(res => {
                setData(res);
                setIsLoading(false);
            })
            .catch(err => {
                console.error(err);
                setIsLoading(false);
            });
    }, []);

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center animate-pulse">
                <Database className="w-12 h-12 text-slate-200" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-reveal max-w-6xl mx-auto w-full pt-8">
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Database className="w-6 h-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold font-display">System History & Logs</h2>
                    <p className="text-sm text-slate-500">Audit trail of background jobs and completed analyses.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Completed Analyses */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        Completed Analyses
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {data?.analyses?.map((a: any) => {
                            const stats = typeof a.stats === 'string' ? JSON.parse(a.stats) : a.stats;
                            return (
                                <div key={a.id} className="p-4 border border-slate-100 dark:border-zinc-800 rounded-xl hover:border-primary/30 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm truncate pr-4">{a.filename || "Unknown File"}</span>
                                        <span className="text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-500 px-2 py-1 rounded font-bold whitespace-nowrap">
                                            {new Date(a.createdAt).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex justify-between items-end">
                                        <div>
                                            <p>Column: <strong className="text-slate-700 dark:text-slate-300">{a.selectedColumn}</strong></p>
                                            <p>Processed: {stats?.totalProcessed?.toLocaleString()}</p>
                                        </div>
                                        {stats?.logData && (
                                            <button 
                                                onClick={() => onViewLog(a.id)}
                                                className="flex items-center gap-1 text-primary bg-primary/10 px-3 py-1.5 rounded-lg font-bold hover:bg-primary hover:text-white transition-colors"
                                            >
                                                <Play className="w-3 h-3" />
                                                View Log
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {(!data?.analyses || data.analyses.length === 0) && (
                            <p className="text-sm text-slate-400 italic">No completed analyses found.</p>
                        )}
                    </div>
                </div>

                {/* Raw Worker Jobs */}
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-amber-500" />
                        Raw Background Jobs
                    </h3>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                        {data?.jobs?.map((j: any) => (
                            <div key={j.id} className="p-4 border border-slate-100 dark:border-zinc-800 rounded-xl hover:border-primary/30 transition-colors">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-mono text-xs text-slate-400">ID: {j.id.split('-')[0]}...</span>
                                    <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider ${
                                        j.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                        j.status === 'failed' ? 'bg-rose-500/10 text-rose-500' :
                                        'bg-amber-500/10 text-amber-500'
                                    }`}>
                                        {j.status}
                                    </span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-zinc-800 h-1.5 rounded-full mb-2 overflow-hidden">
                                    <div className="bg-primary h-full transition-all" style={{ width: `${j.progress}%` }}></div>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2">{j.message || "No message"}</p>
                                {j.status === 'failed' && j.message && (
                                    <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] rounded-lg font-mono">
                                        <AlertCircle className="w-3 h-3 inline-block mr-1" />
                                        {j.message}
                                    </div>
                                )}
                            </div>
                        ))}
                        {(!data?.jobs || data.jobs.length === 0) && (
                            <p className="text-sm text-slate-400 italic">No job activity found.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
