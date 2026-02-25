import { useState, useMemo } from "react";
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragEndEvent
} from "@dnd-kit/core";
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
    X,
    Plus,
    Check,
    LayoutGrid,
    Info,
    GripVertical,
    ChevronRight,
    ChevronDown,
    Trash2,
    CornerDownRight
} from "lucide-react";
import { TaxonomyNode } from "@/lib/ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { FileJson } from "lucide-react";

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Recursive Item Component ---
function SortableTaxonomyItem({
    node,
    path,
    onUpdate,
    onAddChild,
    onRemove
}: {
    node: TaxonomyNode;
    path: number[];
    onUpdate: (path: number[], updates: Partial<TaxonomyNode>) => void;
    onAddChild: (path: number[]) => void;
    onRemove: (path: number[]) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: node.name + path.join("-") });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.5 : 1
    };

    const [isExpanded, setIsExpanded] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(node.name);

    const handleSaveName = () => {
        if (newName.trim() !== node.name) {
            onUpdate(path, { name: newName.trim() });
        }
        setIsEditing(false);
    };

    return (
        <div ref={setNodeRef} style={style} className="mb-2">
            <div className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border transition-all bg-white dark:bg-zinc-900",
                node.isAiSuggested ? "border-amber-200 dark:border-amber-900 bg-amber-50/30 dark:bg-amber-900/10" : "border-slate-200 dark:border-slate-800",
                isDragging ? "shadow-xl ring-2 ring-primary rotate-1 scale-[1.02]" : "hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm"
            )}>
                {/* Drag Handle */}
                <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 p-1">
                    <GripVertical className="w-4 h-4" />
                </div>

                {/* Collapse Toggle */}
                {node.children && node.children.length > 0 ? (
                    <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-slate-600 p-1">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                ) : (
                    <div className="w-6" /> // Spacer
                )}

                {/* Content */}
                <div className="flex-1 flex items-center gap-3">
                    {/* Badge */}
                    {node.isAiSuggested && (
                        <span className="text-[10px] font-bold uppercase text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">AI New</span>
                    )}

                    {/* Name Input/Display */}
                    {isEditing ? (
                        <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onBlur={handleSaveName}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                            className="bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded text-sm font-bold w-full outline-none focus:ring-2 ring-primary/20"
                        />
                    ) : (
                        <span
                            onClick={() => setIsEditing(true)}
                            className="text-sm font-bold cursor-text hover:underline decoration-slate-300 underline-offset-4 decoration-dashed"
                        >
                            {node.name}
                        </span>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onAddChild(path)}
                        className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Add Sub-Category"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onRemove(path)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Recursion for Children */}
            {isExpanded && node.children && node.children.length > 0 && (
                <div className="pl-8 pt-2 border-l-2 border-slate-100 dark:border-slate-800 ml-4">
                    <SortableContext
                        items={node.children.map((child, idx) => child.name + [...path, idx].join("-"))}
                        strategy={verticalListSortingStrategy}
                    >
                        {node.children.map((child, index) => (
                            <SortableTaxonomyItem
                                key={child.name + [...path, index].join("-")}
                                node={child}
                                path={[...path, index]}
                                onUpdate={onUpdate}
                                onAddChild={onAddChild}
                                onRemove={onRemove}
                            />
                        ))}
                    </SortableContext>
                </div>
            )}
        </div>
    );
}


export default function TaxonomyConfirmationModal({
    proposedBuckets,
    onConfirm,
    onCancel
}: {
    proposedBuckets: TaxonomyNode[];
    onConfirm: (buckets: TaxonomyNode[]) => void;
    onCancel: () => void;
}) {
    // Flatten proposed buckets if they come as strings (legacy support)
    const initialTree: TaxonomyNode[] = useMemo(() => {
        if (!proposedBuckets.length) return [];
        // Check if first item is string or object
        if (typeof proposedBuckets[0] === 'string') {
            return (proposedBuckets as unknown as string[]).map(s => ({
                name: s, children: [], isAiSuggested: false
            }));
        }
        return proposedBuckets;
    }, [proposedBuckets]);

    const [tree, setTree] = useState<TaxonomyNode[]>(initialTree);
    const [newRootName, setNewRootName] = useState("");

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // --- Tree Helpers ---

    // Helper to deeply update a node at a path
    const updateNode = (currentTree: TaxonomyNode[], path: number[], updates: Partial<TaxonomyNode>): TaxonomyNode[] => {
        if (path.length === 0) return currentTree;
        const index = path[0];
        if (path.length === 1) {
            return currentTree.map((node, i) => i === index ? { ...node, ...updates } : node);
        }
        return currentTree.map((node, i) =>
            i === index ? { ...node, children: updateNode(node.children, path.slice(1), updates) } : node
        );
    };

    // Helper to remove a node
    const removeNode = (currentTree: TaxonomyNode[], path: number[]): TaxonomyNode[] => {
        const index = path[0];
        if (path.length === 1) {
            return currentTree.filter((_, i) => i !== index);
        }
        return currentTree.map((node, i) =>
            i === index ? { ...node, children: removeNode(node.children, path.slice(1)) } : node
        );
    };

    // Helper to add a child
    const addChild = (currentTree: TaxonomyNode[], path: number[]): TaxonomyNode[] => {
        const index = path[0];
        if (path.length === 1) {
            return currentTree.map((node, i) => i === index ? {
                ...node,
                children: [...node.children, { name: "New Category", children: [], isAiSuggested: false }]
            } : node);
        }
        return currentTree.map((node, i) => i === index ? {
            ...node,
            children: addChild(node.children, path.slice(1))
        } : node);
    };

    // --- Event Handlers ---

    const handleUpdate = (path: number[], updates: Partial<TaxonomyNode>) => {
        setTree(prev => updateNode(prev, path, updates));
    };

    const handleAddChild = (path: number[]) => {
        setTree(prev => addChild(prev, path));
    };

    const handleRemove = (path: number[]) => {
        setTree(prev => removeNode(prev, path));
    };

    const handleAddRoot = () => {
        if (newRootName.trim()) {
            setTree([...tree, { name: newRootName.trim(), children: [], isAiSuggested: false }]);
            setNewRootName("");
        }
    };

    // DnD Handling for Root Level Only (Simplification for Robustness)
    // Deep nested DnD requires a flattened tree projection. Implementing that fully in one file is risky.
    // I will support reordering ONLY at the root level for now to prevent bugs.
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id) {
            // Find indices - this logic is tricky with recursion ids
            // Workaround: We only support root level sorting via this handler for now
            // To support nested, we need to know the parent of active and over.
            // If we use specific DndContexts per list, `onDragEnd` only fires on the parent context?
            // Actually, DndContext should be at root. `SortableContext`s define lists.
            // If we drag between lists, we need logic.

            // Simplification: Reorder Siblings Only logic is implicitly handled if we map IDs correctly?
            // No, we need to find the parent array for both active & over and swap.
            // THIS IS COMPLEX.

            // Safer Approach: ROOT LEVEL SORT ONLY.
            // I'll filter to see if we are dealing with root items.
            // IDs are constructed: Name + Path string.
            // If I can parse Path, I can find the parent.
            // Let's rely on simple buttons for deep moves if DnD fails? No, let's try root sort.

            setTree((items) => {
                // Find items in ROOT
                const oldIndex = items.findIndex(i => i.name + [items.indexOf(i)].join("-") === active.id);
                const newIndex = items.findIndex(i => i.name + [items.indexOf(i)].join("-") === over?.id);

                if (oldIndex !== -1 && newIndex !== -1) {
                    return arrayMove(items, oldIndex, newIndex);
                }
                return items;
            });
        }
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
                <div className="bg-white dark:bg-zinc-950 w-full max-w-4xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
                    <header className="p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start bg-slate-50/50 dark:bg-zinc-900/50 shrink-0">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary/20 p-2.5 rounded-xl">
                                    <LayoutGrid className="w-6 h-6 text-primary" />
                                </div>
                                <h2 className="text-3xl font-display font-bold tracking-tight">Taxonomy Architecture</h2>
                            </div>
                            <p className="text-slate-500 font-medium text-lg leading-relaxed">
                                Curate the exact hierarchy. The AI will map data to these <span className="text-primary font-bold">Leaf Nodes</span>.
                            </p>
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto p-10 space-y-8">
                        {/* Import / Guide Input */}
                        <div className="bg-slate-50 dark:bg-zinc-900 rounded-xl p-4 border border-dashed border-slate-300 dark:border-slate-700">
                            <div className="flex items-center gap-3 mb-3">
                                <FileJson className="w-5 h-5 text-slate-500" />
                                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Import Taxonomy Guide</h4>
                            </div>
                            <textarea
                                placeholder='Paste your JSON guide here... e.g. [{ "name": "Real Estate", "children": [...] }]'
                                className="w-full text-xs font-mono bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-lg p-3 min-h-[80px] outline-none focus:ring-2 ring-primary/20 transition-all"
                                onChange={(e) => {
                                    try {
                                        const val = e.target.value.trim();
                                        if (!val) return;
                                        const parsed = JSON.parse(val);
                                        if (Array.isArray(parsed)) {
                                            // Helper to normalize JSON to TaxonomyNode
                                            const normalize = (items: any[]): TaxonomyNode[] => {
                                                return items.map(item => ({
                                                    name: item.name || item.bucket_name || "Unknown",
                                                    children: item.children ? normalize(item.children) : [],
                                                    isAiSuggested: false
                                                }));
                                            };
                                            const normalized = normalize(parsed);
                                            setTree(normalized);
                                        }
                                    } catch (err) {
                                        // Silent fail or simple validation UI
                                    }
                                }}
                            />
                            <p className="text-[10px] text-zinc-500 mt-2">
                                Paste a valid JSON array to instantly populate the structure above.
                                Supports nested <code>children</code> and keys <code>name</code> or <code>bucket_name</code>.
                            </p>
                        </div>

                        <SortableContext
                            items={tree.map((node, i) => node.name + [i].join("-"))}
                            strategy={verticalListSortingStrategy}
                        >
                            <div className="space-y-1">
                                {tree.map((node, index) => (
                                    <SortableTaxonomyItem
                                        key={node.name + [index].join("-")}
                                        node={node}
                                        path={[index]}
                                        onUpdate={handleUpdate}
                                        onAddChild={handleAddChild}
                                        onRemove={handleRemove}
                                    />
                                ))}
                            </div>
                        </SortableContext>

                        {/* Add Root Bucket Input */}
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                            <Plus className="w-5 h-5 text-slate-400" />
                            <input
                                placeholder="Add new Top-Level Category..."
                                value={newRootName}
                                onChange={(e) => setNewRootName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddRoot()}
                                className="bg-transparent flex-1 outline-none font-bold text-sm"
                            />
                            <button
                                onClick={handleAddRoot}
                                className="bg-primary px-4 py-1.5 rounded-lg text-white font-bold text-xs hover:bg-emerald-600 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <footer className="p-8 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0">
                        <div className="text-sm font-medium text-slate-500">
                            Total Nodes: <span className="text-primary font-bold">{tree.reduce((acc, n) => acc + 1 + (n.children?.length || 0), 0)}</span> (Roots + Children)
                        </div>
                        <div className="flex gap-4 w-full md:w-auto">
                            <button onClick={onCancel} className="flex-1 md:px-8 py-3.5 rounded-xl font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 transition-all">
                                Cancel
                            </button>
                            <button
                                onClick={() => onConfirm(tree)}
                                className="flex-1 md:px-10 py-3.5 bg-primary hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-[0.98]"
                            >
                                Confirm Architecture
                            </button>
                        </div>
                    </footer>
                </div>
            </div>

            <DragOverlay>
                {/* Minimal Overlay for feedback */}
                <div className="p-3 bg-white dark:bg-zinc-900 shadow-2xl rounded-xl border border-primary opacity-90 cursor-grabbing">
                    <span className="font-bold">Moving Item...</span>
                </div>
            </DragOverlay>
        </DndContext>
    );
}
