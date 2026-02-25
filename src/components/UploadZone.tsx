"use client";

import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function UploadZone({ onUpload }: { onUpload: (file: File) => void }) {
    const [isUploading, setIsUploading] = useState(false);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop: async (acceptedFiles) => {
            if (acceptedFiles.length > 0) {
                setIsUploading(true);
                onUpload(acceptedFiles[0]);
            }
        },
        accept: {
            'text/csv': ['.csv'],
        },
        multiple: false
    });

    return (
        <div
            {...getRootProps()}
            className={cn(
                "relative group cursor-pointer transition-all duration-200",
                "w-full h-80 rounded-[2rem]",
                "flex flex-col items-center justify-center p-12 text-center",
                "border-2 border-dashed",
                isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-900 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-zinc-800/50",
                "shadow-sm"
            )}
        >
            <input {...getInputProps()} />

            <div className="mb-6">
                <div className="bg-primary/10 p-5 rounded-2xl text-primary group-hover:scale-110 transition-transform duration-300">
                    <Upload className="w-10 h-10" />
                </div>
            </div>

            <h3 className="font-display text-2xl font-bold mb-2">
                {isDragActive ? "Drop to Ingest" : "Upload Dataset"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm text-sm font-medium">
                Drag and drop your CSV file here to start the <span className="text-primary font-bold">Quantum Enrichment</span> process.
            </p>

            {isUploading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm rounded-[2rem] flex items-center justify-center z-20">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                        <p className="text-sm font-bold text-primary uppercase tracking-widest">Processing...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
