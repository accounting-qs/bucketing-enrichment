"use client";

import { useState } from "react";
import { FileJson, X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function TaxonomyGuideInput({
    onGuideChange
}: {
    onGuideChange: (guide: any[] | null) => void
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [jsonText, setJsonText] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [isValid, setIsValid] = useState(false);

    const handleTextChange = (text: string) => {
        setJsonText(text);
        if (!text.trim()) {
            setError(null);
            setIsValid(false);
            onGuideChange(null);
            return;
        }

        try {
            const parsed = JSON.parse(text);
            if (!Array.isArray(parsed)) {
                throw new Error("JSON must be an array of bucket objects.");
            }
            setError(null);
            setIsValid(true);
            onGuideChange(parsed);
        } catch (err: any) {
            setError(err.message);
            setIsValid(false);
            onGuideChange(null);
        }
    };

    return (
        <div className="bg-slate-50 dark:bg-zinc-950 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
            >
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "p-2.5 rounded-lg transition-colors",
                        isValid ? "bg-primary/20 text-primary" : "bg-slate-200 dark:bg-zinc-800 text-slate-500"
                    )}>
                        <FileJson className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-bold flex items-center gap-2">
                            Custom Taxonomy Guide
                            {isValid && <CheckCircle2 className="w-4 h-4 text-primary" />}
                        </h4>
                        <p className="text-xs text-slate-500 font-medium">Paste a JSON schema to guide the AI's classification</p>
                    </div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {isOpen && (
                <div className="p-5 border-t border-slate-200 dark:border-slate-800 space-y-4 animate-reveal">
                    <div className="relative">
                        <textarea
                            value={jsonText}
                            onChange={(e) => handleTextChange(e.target.value)}
                            placeholder='[ { "bucket_name": "...", "include": ["..."] } ]'
                            className={cn(
                                "w-full h-64 bg-white dark:bg-zinc-900 rounded-xl px-4 py-3 text-xs font-mono border-2 transition-all outline-none",
                                error ? "border-red-500 focus:ring-red-500/10" : "border-slate-100 dark:border-slate-800 focus:border-primary focus:ring-primary/10",
                                "placeholder:text-slate-400"
                            )}
                        />
                        {jsonText && (
                            <button
                                onClick={() => handleTextChange("")}
                                className="absolute top-3 right-3 p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
                            >
                                <X className="w-3 h-3 text-slate-400" />
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="flex items-start gap-3 p-4 bg-primary/5 rounded-xl border border-primary/10">
                        <div className="mt-0.5">
                            <CheckCircle2 className="w-4 h-4 text-primary" />
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                            <strong>Tip:</strong> Providing a guide ensures the AI maps your data to these specific categories.
                            The AI will use the <code>include</code>, <code>exclude</code>, and <code>description</code> fields
                            to determine perfect matches.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
