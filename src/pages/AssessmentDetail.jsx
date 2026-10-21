import React, { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronRight, Layers, Images, Trash2, Pencil, ClipboardList, MoreHorizontal, ExternalLink } from "lucide-react";
import { getAssessment, listTypes, listPhotos, updateType, deleteType } from "@/api/db";
import { Button } from "@/components/ui/button";
import Breadcrumb from "@/components/Breadcrumb";
import NewEquipmentTypeDialog from "@/components/NewEquipmentTypeDialog";
import ReportButton from "@/components/ReportButton";
import ZipButton from "@/components/ZipButton";
import RenameDialog from "@/components/RenameDialog";
import DeleteAssessmentDialog from "@/components/DeleteAssessmentDialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { ensureStandardStructure } from "@/lib/ensureStandardStructure";
import { sortEquipmentTypes } from "@/lib/sortOrder";

export default function AssessmentDetail() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleRenameType = async (newName) => {
    if (!renameTarget) return;
    await updateType(renameTarget.id, { name: newName });
    qc.invalidateQueries({ queryKey: ["equipmentTypes", assessmentId] });
    setRenameTarget(null);
  };

  const handleDeleteType = async (t) => {
    if (!window.confirm(`Delete "${t.name}" and all its photos? The folder moves to Google Drive trash.`)) return;
    try {
      await deleteType(t.id);
    } catch (e) {
      toast({ title: "Couldn't delete", description: e.message, variant: "destructive" });
    }
    qc.invalidateQueries({ queryKey: ["equipmentTypes", assessmentId] });
    qc.invalidateQueries({ queryKey: ["photos", assessmentId] });
  };

  const { data: assessment } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => getAssessment(assessmentId)
  });

  const ensuredRef = useRef({});
  useEffect(() => {
    if (!assessment?.id || assessment.structure_version) return;
    if (ensuredRef.current[assessment.id]) return;
    ensuredRef.current[assessment.id] = true;
    ensureStandardStructure(assessment.id).then((changed) => {
      if (changed) qc.invalidateQueries({ queryKey: ["equipmentTypes", assessmentId] });
      qc.invalidateQueries({ queryKey: ["assessment", assessmentId] });
    });
  }, [assessment?.id]);
  const { data: types, isLoading } = useQuery({
    queryKey: ["equipmentTypes", assessmentId],
    queryFn: () => listTypes(assessmentId)
  });
  const { data: photos } = useQuery({
    queryKey: ["photos", assessmentId],
    queryFn: () => listPhotos(assessmentId)
  });

  const countFor = (typeId) =>
  (photos || []).filter((p) => p.equipment_type_id === typeId).length;

  return (
    <div className="space-y-4">
      <Breadcrumb
        items={[
        { label: "Assessments", to: "/" },
        { label: assessment?.name || "…" }]
        } />
      

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 truncate">
            {assessment?.name || "…"}
          </h1>
          {assessment?.site_location &&
          <p className="text-sm text-neutral-500 mt-0.5 truncate">{assessment.site_location}</p>
          }
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="grid h-9 w-9 place-items-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
                aria-label="Assessment actions"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a href={assessment?.drive_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Open in Google Drive
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                onSelect={() => setDeleteTarget(assessment)}
              >
                <Trash2 className="h-4 w-4" /> Delete assessment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => setDialogOpen(true)} className="rounded-full">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      {assessment &&
      <div className="flex flex-wrap items-center gap-2">
          <ReportButton assessment={assessment} />
          <ZipButton assessment={assessment} photoCount={(photos || []).length} />
        </div>
      }

      {isLoading ?
      <div className="space-y-3">
          {[0, 1, 2].map((i) =>
        <div key={i} className="h-20 rounded-2xl bg-neutral-100 animate-pulse" />
        )}
        </div> :
      !types || types.length === 0 ?
      <div className="rounded-2xl border border-dashed border-neutral-200 py-12 text-center text-sm text-neutral-400">
          No equipment types yet.
        </div> :

      <div className="space-y-3">
          {sortEquipmentTypes(types).map((t) => {
          const std = !!t.is_standard;
          const isDC = std && t.name === "Data Collection";
          const Icon = isDC ? ClipboardList : Layers;
          return (
            <div
              key={t.id}
              className={`rounded-2xl border p-4 shadow-sm transition-all ${
              isDC ?
              "border-amber-200 bg-amber-50/70" :
              "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow"}`
              }>
              
                <div className="flex items-center justify-between gap-3">
                  <Link
                  to={`/assessment/${assessmentId}/type/${t.id}`}
                  className="flex items-center gap-3 min-w-0 flex-1">
                  
                    <span
                    className={`grid h-10 w-10 place-items-center rounded-xl shrink-0 ${
                    isDC ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-600"}`
                    }>
                    
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-neutral-900 truncate flex items-center gap-2">
                        {t.name}
                        {isDC &&
                      <span className="text-[10px] font-medium uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded hidden">
                            Standard
                          </span>
                      }
                      </h3>
                      <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                        <Images className="h-3.5 w-3.5" />
                        {countFor(t.id)} {countFor(t.id) === 1 ? "photo" : "photos"}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-1 shrink-0">
                    {!std &&
                  <>
                        <button
                      onClick={() => setRenameTarget(t)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                      aria-label="Rename equipment type">
                      
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                      onClick={() => handleDeleteType(t)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete equipment type">
                      
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                  }
                    <ChevronRight className="h-5 w-5 text-neutral-300 shrink-0" />
                  </div>
                </div>
              </div>);

        })}
        </div>
      }

      <NewEquipmentTypeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        assessmentId={assessmentId}
        onCreated={() => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["equipmentTypes", assessmentId] });
        }} />
      

      <RenameDialog
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={handleRenameType}
        title="Rename equipment type"
        initialName={renameTarget?.name || ""} />

      <DeleteAssessmentDialog
        open={!!deleteTarget}
        assessment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          qc.invalidateQueries({ queryKey: ["assessments"] });
          toast({ title: "Assessment deleted" });
          navigate("/");
        }}
      />
      
    </div>);

}