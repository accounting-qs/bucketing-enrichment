import { Info, Check, AlertTriangle, DownloadCloud } from "lucide-react";
import Papa from "papaparse";

export default function ReviewModal({
  lowConfidenceItems,
  onClose,
}: {
  lowConfidenceItems: any[];
  onClose: () => void;
}) {
  const handleExport = () => {
    const csvString = Papa.unparse(lowConfidenceItems);
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "low_confidence_records.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden animate-reveal">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-amber-500/10">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
            <h2 className="text-xl font-display font-bold">Manual Review Shield</h2>
          </div>
          <button
            onClick={onClose}
            className="text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            Acknowledge & Close
          </button>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
            The AI assigned the following <strong>{lowConfidenceItems.length}</strong> values with <strong>&lt; 80% confidence</strong>. 
            You can review the reasoning behind its choices below. These items will still be exported in your final CSV, but they will be explicitly flagged with their confidence score for your data science team.
          </p>
          <div className="mt-4 flex gap-3">
             <button
               onClick={handleExport}
               className="bg-white dark:bg-zinc-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:border-amber-500 transition-colors flex items-center gap-2"
             >
               <DownloadCloud className="w-4 h-4" />
               Download Filtered List (.csv)
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="space-y-3">
            {lowConfidenceItems.map((item, idx) => (
              <div key={idx} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-6">
                 <div className="flex-1 min-w-0 flex flex-col gap-1">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Original Value</p>
                   <p className="font-bold text-slate-900 dark:text-white truncate" title={item.value}>{item.value}</p>
                 </div>
                 <div className="flex-1 min-w-0 flex flex-col gap-1">
                   <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Mapped Path</p>
                   <p className="font-medium text-primary text-sm truncate" title={item.mappedPath?.join(" > ")}>
                      {item.mappedPath?.join(" > ")}
                   </p>
                 </div>
                 <div className="flex-1 min-w-0 flex flex-col gap-1">
                   <p className="text-xs font-black text-amber-500 uppercase tracking-widest">Confidence & Reason</p>
                   <p className="text-sm text-slate-600 dark:text-slate-400 truncate" title={item.reason}>
                      <strong>{Math.round(item.confidence * 100)}%</strong> — {item.reason}
                   </p>
                 </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
