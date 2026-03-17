"use client";

import { useState } from "react";
import { Workbook, AnalysisResult, BucketNode } from "@/types";
import UploadZone from "@/components/UploadZone";
import ColumnSelector from "@/components/ColumnSelector";
import FinderTree from "@/components/FinderTree";
import DataPreview from "@/components/DataPreview";
import SuggestionModal, { SuggestedBucket } from "@/components/SuggestionModal";
import TaxonomyConfirmationModal from "@/components/TaxonomyConfirmationModal";
import {
  LayoutDashboard,
  Database,
  Users,
  BarChart,
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Sparkles,
  Plus,
  ChevronRight,
  DownloadCloud
} from "lucide-react";

export default function Home() {
  console.log(">>> Quantum Enricher v1.0.2 - Live results fix active");
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<BucketNode | null>(null);
  const [checkedBucketIds, setCheckedBucketIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Human-in-the-loop state
  const [pendingSuggestions, setPendingSuggestions] = useState<SuggestedBucket[] | null>(null);
  const [proposedTaxonomy, setProposedTaxonomy] = useState<any[] | null>(null); // TaxonomyNode[]
  const [analysisContext, setAnalysisContext] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [activeJob, setActiveJob] = useState<{ id: string; progress: number; message: string; status: string; resultId?: string } | null>(null);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/workbooks/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setWorkbook(data);
    } catch (err) {
      alert("Upload failed: " + (err as Error).message);
    }
  };

  const handleAnalyze = async (selectedColumn: string, provider: string, minClusterSize: number = 50, guide?: any[] | null) => {
    if (!workbook) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/workbooks/${workbook.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedColumn, provider, guide, minClusterSize }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.needsTaxonomyConfirmation) {
        setProposedTaxonomy(data.proposedBuckets);
        setAnalysisContext({
          selectedColumn,
          uniqueValues: data.originalAnalysis.uniqueValues,
          workbookId: workbook.id,
          provider: data.originalAnalysis.provider,
          minClusterSize
        });
      } else if (data.needsConfirmation) {
        setPendingSuggestions(data.suggestedBuckets);
        setAnalysisContext({
          selectedColumn,
          mappedBuckets: data.mappedBuckets,
          workbookId: workbook.id,
          minClusterSize
        });
      } else {
        setAnalysisId(data.analysisId);
        setAnalysis(data);
      }
    } catch (err) {
      alert("Analysis failed: " + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFinalizeTaxonomy = async (confirmedBuckets: any[]) => { // TaxonomyNode[]
    if (!analysisContext) return;
    setIsFinalizing(true);
    setProposedTaxonomy(null);

    try {
      const res = await fetch(`/api/workbooks/${analysisContext.workbookId}/analyze/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedColumn: analysisContext.selectedColumn,
          confirmedBuckets,
          uniqueValues: analysisContext.uniqueValues,
          provider: analysisContext.provider,
          minClusterSize: analysisContext.minClusterSize
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Start Polling
      if (data.jobId) {
        startPolling(data.jobId);
      } else {
        setAnalysisId(data.analysisId);
        setAnalysis(data);
        setIsFinalizing(false);
      }
    } catch (err) {
      alert("Finalization failed: " + (err as Error).message);
      setIsFinalizing(false);
    } finally {
      setAnalysisContext(null);
    }
  };

  const startPolling = (jobId: string) => {
    setActiveJob({ id: jobId, progress: 0, message: "Queuing...", status: "queued" });

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`);
        const job = await res.json();

        if (job.error) {
          clearInterval(interval);
          alert("Job failed: " + job.error);
          setIsFinalizing(false);
          setActiveJob(null);
          return;
        }

        setActiveJob(job);

        if (job.status === 'completed') {
          clearInterval(interval);
          if (job.resultId) {
            try {
              const finalRes = await fetch(`/api/analyses/${job.resultId}`);
              const analysisData = await finalRes.json();
              
              if (analysisData.error) throw new Error(analysisData.error);
              
              setAnalysisId(job.resultId);
              setAnalysis(analysisData);
              setIsFinalizing(false);
              setActiveJob(null);
            } catch (e) {
              console.error("Failed to fetch final analysis:", e);
              alert("Analysis complete, but failed to load results. Please try refreshing.");
              setIsFinalizing(false);
            }
          }
        } else if (job.status === 'failed') {
          clearInterval(interval);
          alert("Job failed: " + job.message);
          setIsFinalizing(false);
          setActiveJob(null);
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 2000);
  };

  const handleConfirmSuggestions = async (approved: SuggestedBucket[], denyAll = false) => {
    if (!analysisContext) return;
    setIsAnalyzing(true);
    setPendingSuggestions(null);

    try {
      const res = await fetch(`/api/workbooks/${analysisContext.workbookId}/analyze/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedColumn: analysisContext.selectedColumn,
          mappedBuckets: analysisContext.mappedBuckets,
          confirmedSuggestedBuckets: approved,
          denyAllSuggestions: denyAll
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnalysisId(data.analysisId);
      setAnalysis(data);
    } catch (err) {
      alert("Confirmation failed: " + (err as Error).message);
    } finally {
      setIsAnalyzing(false);
      setAnalysisContext(null);
    }
  };

  const handleReset = () => {
    setWorkbook(null);
    setAnalysis(null);
    setAnalysisId(null);
    setSelectedBucket(null);
    setCheckedBucketIds(new Set());
    setPendingSuggestions(null);
    setAnalysisContext(null);
  };

  const handleCheckToggle = (node: BucketNode, checked: boolean) => {
    const newChecked = new Set(checkedBucketIds);
    
    // helper to get all children ids recursively
    const getAllIds = (n: BucketNode): string[] => {
      let ids = [n.id];
      if (n.children) {
        n.children.forEach(c => { ids = ids.concat(getAllIds(c)) });
      }
      return ids;
    };

    const nodeAndChildrenIds = getAllIds(node);
    
    if (checked) {
      nodeAndChildrenIds.forEach(id => newChecked.add(id));
    } else {
      nodeAndChildrenIds.forEach(id => newChecked.delete(id));
    }
    
    setCheckedBucketIds(newChecked);
  };

  const [isExporting, setIsExporting] = useState(false);

  const getSelectedRowCount = () => {
    if (!analysis) return 0;
    
    let total = 0;
    const walk = (nodes: BucketNode[]) => {
      for (const n of nodes) {
        if (checkedBucketIds.has(n.id)) {
          total += n.rowCount;
        } else if (n.children) {
          walk(n.children);
        }
      }
    };
    walk(analysis.rootBuckets);
    return total;
  };

  const handleExportSelected = async () => {
    if (!analysisId || !workbook || checkedBucketIds.size === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/workbooks/${workbook.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          analysisId,
          bucketIds: Array.from(checkedBucketIds)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }

      // Read response as Blob
      const blob = await res.blob();
      
      // Get filename from Content-Disposition header if possible
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = "export.csv";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Create a link and trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
    } catch (e: any) {
      alert("Failed to export: " + e.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-sans relative">
      {/* Human-in-the-loop Modal */}
      {pendingSuggestions && (
        <SuggestionModal
          suggestions={pendingSuggestions}
          onConfirm={(approved) => handleConfirmSuggestions(approved)}
          onDeny={() => handleConfirmSuggestions([], true)}
        />
      )}

      {proposedTaxonomy && (
        <TaxonomyConfirmationModal
          proposedBuckets={proposedTaxonomy}
          onConfirm={handleFinalizeTaxonomy}
          onCancel={() => setProposedTaxonomy(null)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <header className="h-16 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-40 shrink-0">
          <div className="flex items-center gap-6">
            <div className="relative">
              <select className="appearance-none bg-slate-100 dark:bg-zinc-900 border-none rounded-lg px-4 py-2 pr-10 text-sm font-semibold cursor-pointer outline-none">
                <option>All Projects</option>
                <option>Quantum Enricher</option>
              </select>
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none w-4 h-4 rotate-90" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-zinc-950"></span>
            </button>
            <button className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors">
              <Sparkles className="w-5 h-5 fill-current" />
            </button>
          </div>
        </header>

        <main className="p-8 flex-1 flex flex-col min-w-0 min-h-0">
          {!workbook ? (
            <div className="animate-reveal space-y-8">
              <div>
                <h1 className="text-3xl font-display font-bold">Welcome Back, Ingestion Module!</h1>
                <p className="text-slate-500 dark:text-slate-400">Ready to expand your data hierarchies today.</p>
              </div>

              <div className="max-w-4xl mx-auto py-12">
                <UploadZone onUpload={handleUpload} />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: "Total Analyses", val: "1,280", icon: BarChart, color: "bg-indigo-500" },
                  { label: "Active Nodes", val: "48k", icon: Database, color: "bg-rose-500" },
                  { label: "AI Accuracy", val: "99.4%", icon: Sparkles, color: "bg-amber-500" },
                  { label: "Export Credits", val: "156", icon: Plus, color: "bg-cyan-500" }
                ].map((stat, i) => (
                  <div key={i} className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-start">
                      <span className={`p-2 ${stat.color} text-white rounded-lg shadow-lg`}>
                        <stat.icon className="w-5 h-5" />
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-3xl font-display font-bold">{stat.val}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : !analysis ? (
            <div className="animate-reveal max-w-5xl mx-auto">
              {isAnalyzing || isFinalizing ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-6">
                  {activeJob ? (
                    <div className="w-full max-w-md space-y-4">
                      <div className="flex justify-between text-sm font-bold uppercase tracking-wider text-slate-500">
                        <span>{activeJob.message}</span>
                        <span>{activeJob.progress}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-500 ease-out"
                          style={{ width: `${activeJob.progress}%` }}
                        />
                      </div>
                      <p className="text-center text-xs text-slate-400">
                        Job ID: {activeJob.id} • Process is running on a dedicated cloud worker
                      </p>
                      {activeJob.status === 'completed' && (
                        <button
                          onClick={async () => {
                            if (activeJob.resultId) {
                              const res = await fetch(`/api/analyses/${activeJob.resultId}`);
                              const data = await res.json();
                              setAnalysis(data);
                              setAnalysisId(activeJob.resultId);
                              setIsFinalizing(false);
                              setActiveJob(null);
                            }
                          }}
                          className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20"
                        >
                          View Results
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                      <div className="text-center">
                        <h3 className="text-xl font-bold font-display">
                          {isFinalizing ? "Deep Taxonomy Mapping" : "Neural Clustering Proposing"}
                        </h3>
                        <p className="text-slate-500 mt-2">
                          {isFinalizing
                            ? "Processing 100% of data rows in AI-driven batches..."
                            : "Identifying global industry patterns for your confirmation..."}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <ColumnSelector workbook={workbook} onAnalyze={handleAnalyze} onReset={handleReset} />
              )}
            </div>
          ) : (
            <div className="animate-reveal space-y-6 flex flex-col h-[calc(100vh-12rem)] min-w-0">
              <div className="flex items-center justify-between shrink-0">
                <div className="min-w-0">
                  <h2 className="text-2xl font-display font-bold flex items-center gap-3 truncate">
                    <button onClick={handleReset} className="text-slate-400 hover:text-primary transition-colors shrink-0">
                      <ChevronRight className="w-6 h-6 rotate-180" />
                    </button>
                    <span className="truncate">{workbook.filename}</span>
                  </h2>
                  <p className="text-sm text-slate-500 mt-1 truncate">
                    Analysing <span className="text-primary font-bold">"{analysis.selectedColumn}"</span> • {analysis.stats.uniqueValues} unique values
                  </p>
                </div>
                <button 
                  onClick={() => handleReset()}
                  className="bg-primary hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2 shrink-0">
                  <Plus className="w-5 h-5" />
                  New Analysis
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-0 min-w-0">
                <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto min-h-0">
                  <FinderTree
                    nodes={analysis.rootBuckets}
                    onSelect={setSelectedBucket}
                    selectedId={selectedBucket?.id || null}
                    checkedIds={checkedBucketIds}
                    onCheckToggle={handleCheckToggle}
                  />
                </div>
                <div className="flex-1 overflow-hidden min-w-0 flex flex-col">
                  <DataPreview
                    bucket={selectedBucket}
                    workbookId={workbook.id}
                    analysisId={analysisId!}
                  />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      
      {/* Floating Action Bar */}
      {analysis && checkedBucketIds.size > 0 && (
        <div className="fixed bottom-6 inset-x-0 mx-auto w-max max-w-2xl bg-slate-900 text-slate-100 px-6 py-4 rounded-full shadow-2xl flex items-center justify-between gap-8 z-50 animate-reveal border border-slate-700">
          <div className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
              {checkedBucketIds.size}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold">Carpetas Seleccionadas</span>
              <span className="text-[11px] text-slate-400 font-medium">{getSelectedRowCount().toLocaleString()} contactos totales</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCheckedBucketIds(new Set())}
              className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Limpiar
            </button>
            <button 
              className={`bg-primary hover:bg-emerald-600 text-white font-bold py-2 px-5 rounded-full text-sm shadow-lg shadow-primary/20 transition-all flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={handleExportSelected}
              disabled={isExporting}
            >
              {isExporting ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <DownloadCloud className="w-4 h-4" />
              )}
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
