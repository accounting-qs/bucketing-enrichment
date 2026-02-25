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
  ChevronRight
} from "lucide-react";

export default function Home() {
  const [workbook, setWorkbook] = useState<Workbook | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<BucketNode | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Human-in-the-loop state
  const [pendingSuggestions, setPendingSuggestions] = useState<SuggestedBucket[] | null>(null);
  const [proposedTaxonomy, setProposedTaxonomy] = useState<any[] | null>(null); // TaxonomyNode[]
  const [analysisContext, setAnalysisContext] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

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

  const handleAnalyze = async (selectedColumn: string, provider: string, guide?: any[] | null) => {
    if (!workbook) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/workbooks/${workbook.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedColumn, provider, guide }),
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      if (data.needsTaxonomyConfirmation) {
        setProposedTaxonomy(data.proposedBuckets);
        setAnalysisContext({
          selectedColumn,
          uniqueValues: data.originalAnalysis.uniqueValues,
          workbookId: workbook.id,
          provider: data.originalAnalysis.provider
        });
      } else if (data.needsConfirmation) {
        setPendingSuggestions(data.suggestedBuckets);
        setAnalysisContext({
          selectedColumn,
          mappedBuckets: data.mappedBuckets,
          workbookId: workbook.id
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
          provider: analysisContext.provider
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setAnalysisId(data.analysisId);
      setAnalysis(data);
    } catch (err) {
      alert("Finalization failed: " + (err as Error).message);
    } finally {
      setIsFinalizing(false);
      setAnalysisContext(null);
    }
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
    setPendingSuggestions(null);
    setAnalysisContext(null);
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

      {/* Sidebar */}
      <aside className="w-64 hidden lg:flex flex-col bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-slate-800 fixed h-full z-30">
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">Quantum Enricher</span>
          </div>

          <nav className="space-y-1">
            <button
              onClick={handleReset}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${!workbook ? 'bg-primary/10 text-primary border-r-4 border-primary' : 'text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-zinc-900'}`}
            >
              <LayoutDashboard className="w-5 h-5" />
              Dashboard
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all">
              <Database className="w-5 h-5" />
              Brands
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all">
              <Users className="w-5 h-5" />
              Users
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all">
              <BarChart className="w-5 h-5" />
              Analytics
            </button>
            <button className="flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium text-slate-500 hover:text-primary hover:bg-slate-50 dark:hover:bg-zinc-900 transition-all">
              <SettingsIcon className="w-5 h-5" />
              Settings
            </button>
          </nav>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-zinc-950 sticky bottom-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
              <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold">QA</div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">QS Admin</p>
              <p className="text-xs text-slate-500 truncate">Manager Account</p>
            </div>
            <button className="text-slate-400 hover:text-slate-600 shrink-0">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-40">
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

        <main className="p-8 flex-1">
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
                </div>
              ) : (
                <ColumnSelector workbook={workbook} onAnalyze={handleAnalyze} onReset={handleReset} />
              )}
            </div>
          ) : (
            <div className="animate-reveal space-y-6 flex flex-col h-[calc(100vh-12rem)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-display font-bold flex items-center gap-3">
                    <button onClick={handleReset} className="text-slate-400 hover:text-primary transition-colors">
                      <ChevronRight className="w-6 h-6 rotate-180" />
                    </button>
                    {workbook.filename}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Analysing <span className="text-primary font-bold">"{analysis.selectedColumn}"</span> • {analysis.stats.uniqueValues} unique values
                  </p>
                </div>
                <button className="bg-primary hover:bg-emerald-600 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  New Analysis
                </button>
              </div>

              <div className="flex-1 flex overflow-hidden bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm min-h-0">
                <div className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 overflow-y-auto">
                  <FinderTree
                    nodes={analysis.rootBuckets}
                    onSelect={setSelectedBucket}
                    selectedId={selectedBucket?.id || null}
                  />
                </div>
                <div className="flex-1 overflow-hidden">
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
    </div>
  );
}
