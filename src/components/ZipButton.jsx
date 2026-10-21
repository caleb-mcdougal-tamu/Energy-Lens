import React, { useMemo, useState } from "react";
import { Archive, Loader2, Share2, AlertCircle } from "lucide-react";
import { buildArchive } from "@/lib/buildArchive";
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

export default function ZipButton({ assessment, photoCount = 0 }) {
  const [phase, setPhase] = useState("idle"); // idle | building | done | error
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [splitDialog, setSplitDialog] = useState(false);
  const [lastFiles, setLastFiles] = useState([]);

  const shareSupported = useMemo(() => canShareFiles(), []);
  const busy = phase === "building";

  const runBuild = async (split) => {
    setPhase("building");
    setProgress({ current: 0, total: photoCount || 0 });
    setLastFiles([]);
    try {
      const result = await buildArchive(assessment, {
        onProgress: (current, total) => setProgress({ current, total }),
        split,
      });

      let files;
      if (result.split) {
        files = result.results.map(
          (r) => new File([r.blob], r.filename, { type: "application/zip" })
        );
        files.forEach(downloadFile);
      } else {
        const file = new File([result.blob], result.filename, { type: "application/zip" });
        files = [file];
        downloadFile(file);
      }
      setLastFiles(files);
      setPhase("done");
    } catch (e) {
      console.error(e);
      setPhase("error");
    }
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

        {phase === "error" && (
          <span className="flex items-center gap-1 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" /> Failed
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