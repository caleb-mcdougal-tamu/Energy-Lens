import React, { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Image as ImageIcon, Loader2, AlertCircle, X } from "lucide-react";
import { uploadPhoto, importDrivePhotos } from "@/api/db";
import { compressImage } from "@/lib/photoCompress";
import TagSelector from "@/components/TagSelector";
import { getActiveTag } from "@/lib/photoTag";
import DrivePhotoPicker from "@/components/DrivePhotoPicker";
import DriveIcon from "@/components/DriveIcon";

export default function PhotoUploadBar({
  assessmentId,
  equipmentTypeId,
  equipmentId,
  photosQueryKey,
  highQuality = false,
  defaultTag = "EQUIPMENT",
}) {
  const cameraRef = useRef(null);
  const libraryRef = useRef(null);
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(null); // { current, total }
  const [summary, setSummary] = useState(null); // { failed, total }
  const [pickerOpen, setPickerOpen] = useState(false);

  const runUpload = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setSummary(null);
    setUploading({ current: 1, total: files.length });

    const failed = [];
    for (let i = 0; i < files.length; i++) {
      setUploading({ current: i + 1, total: files.length });
      try {
        const blob = await compressImage(files[i], highQuality ? 2800 : 1600, highQuality ? 0.85 : 0.75);
        await uploadPhoto(new Blob([blob], { type: "image/jpeg" }), {
          name: `photo_${Date.now()}_${i}.jpg`,
          typeId: equipmentTypeId,
          equipmentId,
          photo_type: getActiveTag(defaultTag),
          captured_at: files[i].lastModified
            ? new Date(files[i].lastModified).toISOString()
            : new Date().toISOString(),
        });
        qc.invalidateQueries({ queryKey: photosQueryKey });
      } catch (err) {
        failed.push({ name: files[i].name, error: err?.message || "failed" });
      }
    }
    setUploading(null);
    qc.invalidateQueries({ queryKey: photosQueryKey });
    if (failed.length) setSummary({ failed, total: files.length });
  };

  const runImport = async (driveFiles) => {
    setPickerOpen(false);
    if (!driveFiles.length) return;
    setSummary(null);
    setUploading({ current: 0, total: driveFiles.length, verb: "Importing" });
    const { failed } = await importDrivePhotos(driveFiles, {
      typeId: equipmentTypeId,
      equipmentId,
      photo_type: getActiveTag(defaultTag),
      onProgress: (current, total) => {
        setUploading({ current, total, verb: "Importing" });
        qc.invalidateQueries({ queryKey: photosQueryKey });
      },
    });
    setUploading(null);
    qc.invalidateQueries({ queryKey: photosQueryKey });
    if (failed.length) setSummary({ failed, total: driveFiles.length, verb: "import" });
  };

  const onPick = (e) => {
    const files = e.target.files;
    if (files && files.length) runUpload(files);
    e.target.value = "";
  };

  const busy = !!uploading;

  return (
    <div className="fixed bottom-0 inset-x-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-2xl px-4 pb-4">
        {summary && (
          <div className="mb-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 shadow-sm">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="font-medium">
                {summary.failed.length} of {summary.total} photo
                {summary.total === 1 ? "" : "s"} failed to {summary.verb || "upload"}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 line-clamp-2">
                {summary.failed.map((f) => f.name).join(", ")}
              </p>
            </div>
            <button
              onClick={() => setSummary(null)}
              className="text-amber-500 hover:text-amber-700 shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {uploading && (
          <div className="mb-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 flex items-center gap-3 text-sm shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-neutral-500 shrink-0" />
            <span className="flex-1 text-neutral-700 font-medium">
              {uploading.verb || "Uploading"} {uploading.current} of {uploading.total}
            </span>
            <div className="h-1.5 w-20 rounded-full bg-neutral-200 overflow-hidden shrink-0">
              <div
                className="h-full bg-neutral-900 transition-all"
                style={{ width: `${(uploading.current / uploading.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="mb-2 rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur shadow-sm p-2">
          <TagSelector contextDefault={defaultTag} />
        </div>

        <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-white/95 backdrop-blur shadow-lg p-2">
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-neutral-900 text-white font-medium disabled:opacity-50"
          >
            <Camera className="h-5 w-5" /> Camera
          </button>
          <button
            onClick={() => libraryRef.current?.click()}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white border border-neutral-200 text-neutral-900 font-medium disabled:opacity-50 hover:bg-neutral-50"
          >
            <ImageIcon className="h-5 w-5" /> Library
          </button>
          <button
            onClick={() => setPickerOpen(true)}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl bg-white border border-neutral-200 text-neutral-900 font-medium disabled:opacity-50 hover:bg-neutral-50"
          >
            <DriveIcon className="h-5 w-5" /> Drive
          </button>
        </div>
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
      />
      <input
        ref={libraryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      <DrivePhotoPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={runImport}
        excludeFolderId={equipmentId || equipmentTypeId}
      />
    </div>
  );
}