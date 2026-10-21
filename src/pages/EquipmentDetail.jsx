import React from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAssessment, getType, getEquipment, listPhotos, deletePhoto } from "@/api/db";
import { useToast } from "@/components/ui/use-toast";
import Breadcrumb from "@/components/Breadcrumb";
import PhotoGrid from "@/components/PhotoGrid";
import PhotoUploadBar from "@/components/PhotoUploadBar";

export default function EquipmentDetail() {
  const { assessmentId, typeId, equipmentId } = useParams();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: assessment } = useQuery({
    queryKey: ["assessment", assessmentId],
    queryFn: () => getAssessment(assessmentId),
  });
  const { data: type } = useQuery({
    queryKey: ["equipmentType", typeId],
    queryFn: () => getType(typeId),
  });
  const { data: equipment } = useQuery({
    queryKey: ["equipmentItem", equipmentId],
    queryFn: () => getEquipment(equipmentId),
  });
  const { data: photos } = useQuery({
    queryKey: ["photos", assessmentId],
    queryFn: () => listPhotos(assessmentId),
  });

  const eqPhotos = (photos || []).filter((p) => p.equipment_id === equipmentId);

  const handleDelete = async (photo) => {
    try {
      await deletePhoto(photo.id);
    } catch (e) {
      toast({ title: "Couldn't delete photo", description: e.message, variant: "destructive" });
    }
    qc.invalidateQueries({ queryKey: ["photos", assessmentId] });
  };

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Assessments", to: "/" },
          { label: assessment?.name || "…", to: `/assessment/${assessmentId}` },
          { label: type?.name || "…", to: `/assessment/${assessmentId}/type/${typeId}` },
          { label: equipment?.name || "…" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
          {equipment?.name || "…"}
        </h1>
        <p className="text-sm text-neutral-500 mt-0.5">Equipment</p>
      </div>

      <PhotoGrid
        photos={eqPhotos}
        onDelete={handleDelete}
        photosQueryKey={["photos", assessmentId]}
      />

      <PhotoUploadBar
        assessmentId={assessmentId}
        equipmentTypeId={typeId}
        equipmentId={equipmentId}
        photosQueryKey={["photos", assessmentId]}
        highQuality={!!type?.is_standard}
        defaultTag={type?.name === "Data Collection" ? "DATACOLLECTION" : "EQUIPMENT"}
      />
      <div className="h-28" />
    </div>
  );
}