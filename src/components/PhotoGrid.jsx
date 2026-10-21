import React, { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Check } from "lucide-react";
import { updatePhotos } from "@/api/db";
import DriveImage from "@/components/DriveImage";
import { TAGS } from "@/lib/photoTag";
import { cn } from "@/lib/utils";
import PhotoViewer from "@/components/PhotoViewer";

const tagOf = (p) => (p.photo_type || "EQUIPMENT").toUpperCase();

export default function PhotoGrid({ photos, onDelete, photosQueryKey }) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState(null);
  const [filterTag, setFilterTag] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const lpTimer = useRef(null);

  const all = photos || [];
  const active = all.find((p) => p.id === activeId) || null;
  const tagsPresent = TAGS.filter((t) => all.some((p) => tagOf(p) === t));
  const filtered = filterTag ? all.filter((p) => tagOf(p) === filterTag) : all;

  const toggleSel = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const startLongPress = (p) => {
    lpTimer.current = setTimeout(() => {
      setSelectMode(true);
      setSelected(new Set([p.id]));
      lpTimer.current = null;
    }, 450);
  };
  const cancelLongPress = () => {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  };

  const applyBatchTag = async (tag) => {
    const ids = [...selected];
    if (!ids.length) return;
    try {
      await updatePhotos(ids, { photo_type: tag });
      qc.invalidateQueries({ queryKey: photosQueryKey });
    } catch (e) {
      console.error(e);
    }
    setSelected(new Set());
  };

  const exitSelect = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  if (all.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-400">
        <ImageIcon className="h-6 w-6 mx-auto mb-2 text-neutral-300" />
        No photos yet
      </div>
    );
  }

  const chip = (on) =>
    cn(
      "shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors",
      on
        ? "bg-neutral-900 text-white border-neutral-900"
        : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300"
    );

  return (
    <>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button onClick={() => setFilterTag(null)} className={chip(filterTag === null)}>
          All
        </button>
        {tagsPresent.map((t) => (
          <button key={t} onClick={() => setFilterTag(t)} className={chip(filterTag === t)}>
            {t}
          </button>
        ))}
        <div className="ml-auto pl-2 shrink-0">
          {!selectMode ? (
            <button
              onClick={() => setSelectMode(true)}
              className="h-7 px-3 rounded-full text-[11px] font-medium border border-neutral-200 text-neutral-600 hover:border-neutral-300"
            >
              Select
            </button>
          ) : (
            <button
              onClick={exitSelect}
              className="h-7 px-3 rounded-full text-[11px] font-medium bg-neutral-900 text-white"
            >
              Done
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
        {filtered.map((p) => {
          const sel = selected.has(p.id);
          return (
            <button
              key={p.id}
              onClick={() => (selectMode ? toggleSel(p.id) : setActiveId(p.id))}
              onPointerDown={() => !selectMode && startLongPress(p)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              className={cn(
                "relative aspect-square rounded-xl overflow-hidden bg-neutral-100 ring-1 transition",
                sel ? "ring-2 ring-neutral-900" : "ring-neutral-200/60 hover:ring-neutral-300"
              )}
            >
              <DriveImage
                photo={p}
                className="absolute inset-0 h-full w-full object-cover"
                alt={p.caption || ""}
              />
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wide bg-black/55 text-white">
                {tagOf(p)}
              </span>
              {sel && (
                <span className="absolute top-1 right-1 grid h-5 w-5 place-items-center rounded-full bg-neutral-900 text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
              {p.caption && (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 text-[10px] text-white line-clamp-1 text-left">
                  {p.caption}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectMode && selected.size > 0 && (
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-neutral-200 bg-neutral-50 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs text-neutral-500 shrink-0">
            Set tag for {selected.size}:
          </span>
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => applyBatchTag(t)}
              className="shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
            >
              {t}
            </button>
          ))}
        </div>
      )}

      <PhotoViewer
        photo={active}
        photos={all}
        photosQueryKey={photosQueryKey}
        onClose={() => setActiveId(null)}
        onNavigate={setActiveId}
        onDelete={onDelete}
      />
    </>
  );
}