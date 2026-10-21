import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAssessment } from "@/api/db";
import { useAuth } from "@/lib/AuthContext";
import { ensureStandardStructure } from "@/lib/ensureStandardStructure";

export default function NewAssessmentDialog({ open, onClose, onCreated }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [siteLocation, setSiteLocation] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const assessment = await createAssessment({
        name: name.trim(),
        site_location: siteLocation.trim(),
        assessment_date: date || undefined,
        created_by: user?.email || "",
      });
      await ensureStandardStructure(assessment.id);
      setName("");
      setSiteLocation("");
      setDate("");
      onCreated();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Assessment</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="asmt-name">Name *</Label>
            <Input
              id="asmt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              placeholder="e.g. Plant 4 Annual Audit"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asmt-site">Site location</Label>
            <Input
              id="asmt-site"
              value={siteLocation}
              onChange={(e) => setSiteLocation(e.target.value)}
              placeholder="e.g. Houston Refinery — Block C"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="asmt-date">Assessment date</Label>
            <Input
              id="asmt-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}