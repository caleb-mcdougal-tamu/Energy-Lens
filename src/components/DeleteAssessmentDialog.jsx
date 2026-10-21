import React, { useEffect, useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteAssessmentCascade, loadAssessmentDeleteContext } from "@/lib/deleteAssessment";

export default function DeleteAssessmentDialog({ open, assessment, onClose, onDeleted }) {
  const [photoCount, setPhotoCount] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !assessment?.id) return;
    setConfirmText("");
    setPhotoCount(null);
    loadAssessmentDeleteContext(assessment.id).then((ctx) => setPhotoCount(ctx.photoCount));
  }, [open, assessment?.id]);

  if (!assessment) return null;

  const name = assessment.name || "";
  const number = assessment.assessment_number || "";
  const trimmed = confirmText.trim();
  const matches =
    trimmed.length > 0 &&
    (trimmed.toLowerCase() === name.trim().toLowerCase() ||
      (!!number && trimmed === number));

  const handleDelete = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    try {
      await deleteAssessmentCascade(assessment.id);
      onDeleted();
    } catch (e) {
      console.error(e);
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" /> Delete assessment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-neutral-700">
          <p>
            You're about to delete{" "}
            <span className="font-semibold text-neutral-900">{name}</span>.
            {photoCount !== null && (
              <>
                {" "}Its folder and {photoCount} photo
                {photoCount === 1 ? "" : "s"} will be moved to the Google Drive trash.
              </>
            )}
          </p>
          <p className="text-neutral-600">
            It disappears from Energy Lens for everyone it&rsquo;s shared with. The owner can
            restore it from the Drive trash for 30 days.
          </p>
          <div>
            <p className="text-neutral-700 mb-1.5">
              Type the assessment name{number ? " or number" : ""} to confirm:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={name}
              autoFocus
              disabled={deleting}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={!matches || deleting}
            className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete assessment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}