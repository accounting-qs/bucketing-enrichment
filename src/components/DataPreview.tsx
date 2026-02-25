"use client";

import { BucketNode } from "@/types";
import { Search, Download, Table, FileSpreadsheet, XCircle, FileText } from "lucide-react";
import { useState, useMemo } from "react";

export default function DataPreview({
    bucket,
    workbookId,
    analysisId
}: {
    bucket: BucketNode | null;
    workbookId: string;
    analysisId: string;
}) {
    const [rows, setRows] = useState<any[]>([]);
    const [columns, setColumns] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [lastFetched, setLastFetched] = useState<string | null>(null);

    useMemo(async () => {
        if (!bucket || !analysisId) return;
        if (lastFetched === bucket.id) return;

        setIsLoading(true);
        try {
            const res = await fetch(`/api/workbooks/${workbookId}/bucketRows?analysisId=${analysisId}&bucketId=${bucket.id}`);
            const data = await res.json();
            setRows(data.rows || []);
            setColumns(data.columns || []);
            setLastFetched(bucket.id);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [bucket?.id, workbookId, analysisId]);

    const filteredRows = useMemo(() => {
        if (!searchTerm) return rows;
        const lowerSearch = searchTerm.toLowerCase();
        return rows.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(lowerSearch)
            )
        );
    }, [rows, searchTerm]);

    const handleExport = () => {
        if (rows.length === 0) return;
        const csv = [
            columns.join(","),
            ...rows.map(row => columns.map(col => `"${String(row[col]).replace(/"/g, '""')}"`).join(","))
        ].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.setAttribute("hidden", "");
        a.setAttribute("href", url);
        a.setAttribute("download", `${bucket?.name || 'bucket'}_export.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    if (!bucket) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 text-center">
                <div className="bg-slate-100 dark:bg-zinc-800 p-6 rounded-3xl mb-4">
                    <FileText className="w-12 h-12 opacity-20" />
                </div>
                <p className="font-display font-medium text-lg">Select a Cluster</p>
                <p className="text-sm max-w-[200px] mt-2">Explore the data within each taxonomic bucket.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col animate-reveal bg-white dark:bg-zinc-950">
            {/* Table Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 z-10 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
                <div>
                    <h2 className="text-xl font-display font-bold flex items-center gap-2">
                        <span className="w-2 h-6 bg-primary rounded-full" />
                        {bucket.name}
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                        Displaying top {Math.min(50, bucket.rowCount)} of {bucket.rowCount.toLocaleString()} records
                    </p>
                </div>
                <div className="flex gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search sequence..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-slate-100 dark:bg-zinc-900 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none w-64 transition-all"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-6 py-2 bg-primary hover:bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                </div>
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-auto">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center p-12">
                        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12">
                        <XCircle className="w-12 h-12 opacity-10 mb-2" />
                        <p className="text-sm font-medium">No results found in this cluster</p>
                    </div>
                ) : (
                    <table className="w-full text-left text-sm border-separate border-spacing-0">
                        <thead className="sticky top-0 z-20">
                            <tr>
                                {columns.map(col => (
                                    <th key={col} className="px-6 py-4 font-bold text-slate-400 uppercase tracking-widest text-[10px] bg-slate-50 dark:bg-zinc-900 border-b border-slate-100 dark:border-slate-800">
                                        {col}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filteredRows.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors group">
                                    {columns.map(col => (
                                        <td key={col} className="px-6 py-4 text-slate-700 dark:text-slate-300 font-medium truncate max-w-xs group-hover:text-primary">
                                            {String(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
