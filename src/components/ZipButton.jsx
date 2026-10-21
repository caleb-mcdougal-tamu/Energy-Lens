import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Loader2, Share2, Download, AlertCircle } from "lucide-react";
import { buildArchive } from "@/lib/buildArchive";
import { saveExport, exportStamp } from "@/api/db";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

function canShareFiles() {
  try {
    if (typeof navigator === "undefined" || typeof navigator.canShare !== "function")
      return false;
    const f = new File([new Blob([""], { type: "application/zip" })], "t.zip", {
      type: "application/zip",
    });
    return navigator.canShare({ files: [f] });
  } catch {
    return false;
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

const estimateMb = (n) => Math.round(n * 0.45);

// "Acme.zip" -> "Acme_2026-10-21_1430.zip"
const withStamp = (filename, stamp) => filename.replace(/(\.zip)?$/i, `_${stamp}.zip`);

export default function ZipButton({ assessment, photoCount = 0 }) {
  const qc = useQueryClient();
  const [phase, setPhase] = useState("idle"); // idle | building | saving | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [splitDialog, setSplitDialog] = useState(false);
  const [lastFiles, setLastFiles] = useState([]);
  const [saveFailed, setSaveFailed] = useState(false);

  const shareSupported = useMemo(() => canShareFiles(), []);
  const busy = phase === "building" || phase === "saving";

  const runBuild = async (split) => {
    setPhase("building");
    setProgress({ current: 0, total: photoCount || 0 });
    setLastFiles([]);
    setSaveFailed(false);
    let files;
    try {
      const result = await buildArchive(assessment, {
        onProgress: (current, total) => setProgress({ current, total }),
        split,
      });
      const stamp = exportStamp();
      const parts = result.split ? result.results : [result];
      files = parts.map(
        (r) => new File([r.blob], withStamp(r.filename, stamp), { type: "application/zip" })
      );
      files.forEach(downloadFile);
      setLastFiles(files);
    } catch (e) {
      console.error(e);
      setPhase("error");
      return;
    }

    // Keep a copy in the assessment's Exports folder in Drive. Split
    // archives are all saved; only a single archive becomes "Last archive".
    setPhase("saving");
    try {
      for (const file of files) {
        await saveExport(assessment, file, {
          filename: file.name,
          mimeType: "application/zip",
          latestKey: files.length === 1 ? "zip_file_id" : undefined,
        });
      }
      qc.invalidateQueries({ queryKey: ["assessment", assessment.id] });
    } catch (e) {
      console.error(e);
      setSaveFailed(true);
    }
    setPhase("done");
  };

  const confirmSingleSize = () =>
    estimateMb(photoCount) <= 150 ||
    window.confirm(
      `This archive is ~${estimateMb(photoCount)} MB. Building an archive this large in a phone browser may run out of memory. Continue?`
    );

  const onClick = async () => {
    if (busy) return;
    if (photoCount > 300) {
      setSplitDialog(true);
      return;
    }
    if (confirmSingleSize()) runBuild(false);
  };

  const onSplitChoice = (choice) => {
    setSplitDialog(false);
    if (choice === "cancel") return;
    if (choice === "split") {
      runBuild(true);
    } else {
      if (confirmSingleSize()) runBuild(false);
    }
  };

  const share = async () => {
    try {
      await navigator.share({
        files: lastFiles,
        title: assessment.name || "Assessment archive",
      });
    } catch {
      /* user cancelled */
    }
  };

  const label =
    phase === "building"
      ? `Building ${progress.current}/${progress.total || "…"}`
      : phase === "saving"
      ? "Saving to Drive…"
      : "Download ZIP";

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onClick}
          disabled={busy}
          className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-neutral-900 text-white text-sm font-medium disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
          {label}
        </button>

        {shareSupported && lastFiles.length > 0 && (
          <button
            onClick={share}
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-neutral-200 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        )}

        {assessment?.zip_file_url && (
          <a
            href={assessment.zip_file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 h-9 px-3.5 rounded-full border border-neutral-200 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50"
          >
            <Download className="h-4 w-4" /> Last archive
          </a>
        )}

        {phase === "error" && (
          <span className="flex items-center gap-1 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" /> Failed
          </span>
        )}
        {saveFailed && (
          <span className="flex items-center gap-1 text-sm text-amber-600">
            <AlertCircle className="h-4 w-4" /> Downloaded, but couldn&rsquo;t save a copy to Drive
          </span>
        )}
      </div>

      <Dialog open={splitDialog} onOpenChange={(o) => !o && setSplitDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Large export</DialogTitle>
            <DialogDescription>
              This assessment has {photoCount} photos. A single archive may be slow or run out of
              memory on a phone. Split into one zip per equipment type?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => onSplitChoice("cancel")}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => onSplitChoice("single")}>
              Single archive
            </Button>
            <Button onClick={() => onSplitChoice("split")}>Split per type</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}