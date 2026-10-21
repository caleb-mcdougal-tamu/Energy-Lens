import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Download, AlertCircle } from "lucide-react";
import { saveReport } from "@/api/db";
import { generateReport } from "@/lib/generateReport";

export default function ReportButton({ assessment }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState("idle"); // idle | generating | uploading | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const busy = phase === "generating" || phase === "uploading";

  const handleGenerate = async () => {
    if (busy) return;
    setPhase("generating");
    setProgress({ current: 0, total: 0 });
    try {
      const blob = await generateReport(assessment, ({ current, total }) =>
        setProgress({ current, total })
      );

      // Direct download
      const filename = `${(assessment.name || "assessment").replace(/[^\w\-]+/g, "_")}-report.pdf`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      // Save to the assessment's Exports folder in Drive for re-download
      setPhase("uploading");
      await saveReport(assessment, blob, filename);
      qc.invalidateQueries({ queryKey: ["assessment", assessment.id] });
      setPhase("done");
    } catch (e) {
      console.error(e);
      setPhase("error");
    }
  };

  const label =
    phase === "generating"
      ? `Generating ${progress.current}/${progress.total || "…"}`
      : phase === "uploading"
      ? "Saving…"
      : phase === "done"
      ? "Generate PDF"
      : "Generate PDF";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={busy}
        className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-neutral-900 text-white text-sm font-medium disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {label}
      </button>

      {assessment?.report_file_url && (
        <a
          href={assessment.report_file_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-neutral-200 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50"
        >
          <Download className="h-4 w-4" /> Last report
        </a>
      )}

      {phase === "error" && (
        <span className="flex items-center gap-1 text-sm text-red-500">
          <AlertCircle className="h-4 w-4" /> Failed
        </span>
      )}
    </div>
  );
}