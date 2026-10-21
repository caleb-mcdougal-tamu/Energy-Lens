import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MapPin, Calendar, ChevronRight, FolderOpen, Trash2, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { listAssessments } from "@/api/db";
import { Button } from "@/components/ui/button";
import Breadcrumb from "@/components/Breadcrumb";
import NewAssessmentDialog from "@/components/NewAssessmentDialog";
import DeleteAssessmentDialog from "@/components/DeleteAssessmentDialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";

export default function Home() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const { data: assessments, isLoading, error } = useQuery({
    queryKey: ["assessments"],
    queryFn: listAssessments
  });

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: "Assessments" }]} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Assessments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Organize field photos by site and equipment. Saved to your Google Drive.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="rounded-full shrink-0">
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {error &&
      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          Couldn't load assessments from Google Drive: {error.message}
        </p>
      }

      {isLoading ?
      <div className="space-y-3">
          {[0, 1, 2].map((i) =>
        <div key={i} className="h-24 rounded-2xl bg-neutral-100 animate-pulse" />
        )}
        </div> :
      !assessments || assessments.length === 0 ?
      <div className="rounded-2xl border border-dashed border-neutral-200 py-16 text-center">
          <div className="grid h-12 w-12 mx-auto place-items-center rounded-full bg-neutral-100 mb-3">
            <FolderOpen className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="text-neutral-600 font-medium">No assessments yet</p>
          <p className="text-sm text-neutral-400 mt-1 mb-4">
            Create your first assessment to start organizing field photos.
          </p>
          <Button onClick={() => setDialogOpen(true)} className="rounded-full">
            <Plus className="h-4 w-4" /> New Assessment
          </Button>
        </div> :

      <div className="space-y-3">
          {assessments.map((a) =>
        <Link key={a.id} to={`/assessment/${a.id}`} className="block group">
              <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300 hover:shadow transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-neutral-900 truncate">{a.name}</h3>
                    {a.site_location &&
                <p className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{a.site_location}</span>
                      </p>
                }
                    <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                      {a.assessment_date &&
                  <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {format(parseISO(a.assessment_date), "MMM d, yyyy")}
                        </span>
                  }
                      {a.shared &&
                  <span className="flex items-center gap-1 shrink-0">
                          <Users className="h-3.5 w-3.5" /> Shared
                        </span>
                  }
                      {a.created_by && <span className="truncate">{a.created_by}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        





                    
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                      className="text-red-600 focus:text-red-600 focus:bg-red-50"
                      onSelect={() => setDeleteTarget(a)}>
                      
                          <Trash2 className="h-4 w-4" /> Delete assessment
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <ChevronRight className="h-5 w-5 text-neutral-300 group-hover:text-neutral-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </div>
            </Link>
        )}
        </div>
      }

      <NewAssessmentDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={() => {
          setDialogOpen(false);
          qc.invalidateQueries({ queryKey: ["assessments"] });
        }} />
      

      <DeleteAssessmentDialog
        open={!!deleteTarget}
        assessment={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          setDeleteTarget(null);
          qc.invalidateQueries({ queryKey: ["assessments"] });
          toast({ title: "Assessment deleted" });
        }} />
      
    </div>);

}