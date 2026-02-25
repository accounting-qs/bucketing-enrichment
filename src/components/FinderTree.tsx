"use client";

import { BucketNode } from "@/types";
import { Folder, FolderOpen, ChevronRight, ChevronDown, ListFilter } from "lucide-react";
import { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export default function FinderTree({
    nodes,
    onSelect,
    selectedId
}: {
    nodes: BucketNode[];
    onSelect: (node: BucketNode) => void;
    selectedId: string | null;
}) {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-950">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    Clusters
                </h3>
                <span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
                    Refined
                </span>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
                {nodes.map(node => (
                    <TreeNode
                        key={node.id}
                        node={node}
                        onSelect={onSelect}
                        selectedId={selectedId}
                        depth={0}
                    />
                ))}
            </div>
        </div>
    );
}

function TreeNode({
    node,
    onSelect,
    selectedId,
    depth
}: {
    node: BucketNode;
    onSelect: (node: BucketNode) => void;
    selectedId: string | null;
    depth: number;
}) {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const isSelected = selectedId === node.id;
    const hasChildren = node.children && node.children.length > 0;

    return (
        <div className="flex flex-col">
            <div
                onClick={() => {
                    onSelect(node);
                    if (hasChildren) setIsOpen(!isOpen);
                }}
                className={cn(
                    "flex items-center gap-2 py-2 px-4 cursor-pointer select-none group border-r-4 transition-all",
                    isSelected
                        ? "bg-primary/5 text-primary border-primary"
                        : "hover:bg-slate-50 dark:hover:bg-zinc-900 text-slate-600 dark:text-slate-400 border-transparent"
                )}
                style={{ paddingLeft: `${(depth * 16) + 16}px` }}
            >
                <div className="w-4 h-4 flex items-center justify-center">
                    {hasChildren ? (
                        isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />
                    ) : null}
                </div>

                <div className={cn(
                    "flex items-center gap-2",
                    isSelected ? "text-primary" : "text-slate-400 group-hover:text-primary"
                )}>
                    {hasChildren ? (
                        isOpen ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />
                    ) : (
                        <Folder className="w-4 h-4 opacity-40" />
                    )}
                </div>

                <span className="flex-1 truncate text-sm font-semibold">
                    {node.name}
                </span>

                <span className={cn(
                    "text-[10px] tabular-nums font-bold",
                    isSelected ? "text-primary" : "text-slate-400"
                )}>
                    {node.rowCount.toLocaleString()}
                </span>
            </div>

            {hasChildren && isOpen && (
                <div className="animate-reveal">
                    {node.children.map(child => (
                        <TreeNode
                            key={child.id}
                            node={child}
                            onSelect={onSelect}
                            selectedId={selectedId}
                            depth={depth + 1}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
