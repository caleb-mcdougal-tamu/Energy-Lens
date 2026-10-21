import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ChevronRight, Wrench, Trash2, Pencil } from "lucide-react";
import {
  getAssessment,
  getType,
  listPhotos,
  listEquipment,
  updateEquipment,
  deleteEquipment,
  deletePhoto,
} from "@/api/db";
import { Button } from "@/components/ui/button";
import Breadcrumb from "@/components/Breadcrumb";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoUploadBar from "@/components/PhotoUploadBar";
import NewEquipmentDialog from "@/components/NewEquipmentDialog";
import RenameDialog from "@/components/RenameDialog";
import { sortEquipment } from "@/lib/sortOrder";
import { useToast } from "@/components/ui/use-toast";

export default function EquipmentTypeDetail() {
  const { assessmentId, typeId } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);

  const handleRenameEquip = async (newName) => {
    if (!renameTarget) return;
    await updateEquipment(renameTarget.id, { name: newName });
    qc.invalidateQueries({ queryKey: ["equipment", typeId] });
    setRenameTarget(null);
  };

  const handleDeleteEquip = async (eq) => {
    if (!window.confirm(`Delete "${eq.name}" and all its photos? The folder moves to Google Drive trash.`)) return;
    try {
      await deleteEquipment(eq.id);
    } catch (e) {
      toast({ title: "Couldn't delete", description: e.message, variant: "destructive" });
    }
    qc.invalidateQueries({ queryKey: ["equipment", typeId] });
    qc.invalidateQueries({ queryKey: ["photos", assessmentId] });
  };

  const { data: assessment } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => getAssessment(assessmentId),
  });
  const { data: type } = useQuery({
    queryKey: ["equipmentType", typeId],
    queryFn: () => getType(typeId),
  });
  const { data: photos } = useQuery({
    queryKey: ["photos", assessmentId],
    queryFn: () => listPhotos(assessmentId),
  });
  const { data: equipment } = useQuery({
    queryKey: ["equipment", typeId],
    queryFn: () => listEquipment(typeId),
  });

  const typePhotos = (photos || []).filter(
    (p) => p.equipment_type_id === typeId && !p.equipment_id
  );
  const countFor = (eqId) => (photos || []).filter((p) => p.equipment_id === eqId).length;

  const handleDelete = async (photo) => {
    try {
      await deletePhoto(photo.id);
    } catch (e) {
      toast({ title: "Couldn't delete photo", description: e.message, variant: "destructive" });
    }
    qc.invalidateQueries({ queryKey: ["photos", assessmentId] });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: "Assessments", to: "/" },
          { label: assessment?.name || "…", to: `/assessment/${assessmentId}` },
          { label: type?.name || "…" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {type?.name || "…"}
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">Equipment type</p>
      </div>

      {/* Section 1: Type-level photos */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">
          Type Photos
        </h2>
        <PhotoGrid
          photos={typePhotos}
          onDelete={handleDelete}
          photosQueryKey={["photos", assessmentId]}
        />
      </section>

      {/* Section 2: Equipment */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wide">
            {type?.is_standard ? "Data sheets by equipment category" : "Equipment"}
          </h2>
          <Button
            onClick={() => setDialogOpen(true)}
            variant="outline"
            className="rounded-full"
          >
            <Plus className="h-4 w-4" /> New Equipment
          </Button>
        </div>

        {!equipment || equipment.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400">
            No equipment added yet.
          </div>
        ) : (
          <div className="space-y-3">
            {sortEquipment(equipment).map((eq) => {
              const std = !!eq.is_standard;
              return (
                <div
                  key={eq.id}
                  className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300 hover:shadow transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      to={`/assessment/${assessmentId}/type/${typeId}/equipment/${eq.id}`}
                      className="flex items-center gap-3 min-w-0 flex-1"
                    >
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-neutral-100 text-neutral-600 shrink-0">
                        <Wrench className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-neutral-900 truncate">{eq.name}</h3>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {countFor(eq.id)} {countFor(eq.id) === 1 ? "photo" : "photos"}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 shrink-0">
                      {!std && (
                        <>
                          <button
                            onClick={() => setRenameTarget(eq)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            aria-label="Rename equipment"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEquip(eq)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Delete equipment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                      <ChevronRight className="h-5 w-5 text-neutral-300 shrink-0" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <NewEquipmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        equipmentTypeId={typeId}
        onCreated={() => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["equipment", typeId] });
        }}
      />

      <RenameDialog
        open={!!renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={handleRenameEquip}
        title="Rename equipment"
        initialName={renameTarget?.name || ""}
      />

      <PhotoUploadBar
        assessmentId={assessmentId}
        equipmentTypeId={typeId}
        equipmentId={null}
        photosQueryKey={["photos", assessmentId]}
        highQuality={!!type?.is_standard}
        defaultTag={type?.name === "Data Collection" ? "DATACOLLECTION" : "EQUIPMENT"}
      />
      <div className="h-28" />
    </div>
  );
}