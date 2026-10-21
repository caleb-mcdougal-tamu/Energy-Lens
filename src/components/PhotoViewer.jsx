import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { updatePhoto } from "@/api/db";
import { useFullImageSrc, prefetchFullImage } from "@/lib/google/driveImages";
import { TAGS } from "@/lib/photoTag";
import { cn } from "@/lib/utils";

const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const TAP_SLOP = 8; // px — movement below this counts as a tap

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export default function PhotoViewer({
  photo,
  photos = [],
  onClose,
  onDelete,
  onNavigate,
  photosQueryKey,
}) {
  const qc = useQueryClient();
  const [tag, setTag] = useState("EQUIPMENT");

  // Full folder list (ignores any grid tag filter); grid order is the
  // photos array order, which is what we swipe through.
  const list = photos && photos.length ? photos : photo ? [photo] : [];
  const index = photo ? list.findIndex((p) => p.id === photo.id) : -1;
  const current = index >= 0 ? list[index] : photo;
  const image = useFullImageSrc(current);

  // Zoom / pan state
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [imgBox, setImgBox] = useState({ w: 0, h: 0 });
  const [gesturing, setGesturing] = useState(false);

  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(0);
  const lastIdRef = useRef(photo?.id);

  // Reset zoom/pan the moment the displayed photo changes (during render,
  // so the new photo never appears with the old photo's transform).
  if (photo && lastIdRef.current !== photo.id) {
    lastIdRef.current = photo.id;
    setScale(1);
    setTx(0);
    setTy(0);
    setImgBox({ w: 0, h: 0 });
  }

  const goNext = useCallback(() => {
    if (index >= 0 && index < list.length - 1 && onNavigate)
      onNavigate(list[index + 1].id);
  }, [index, list, onNavigate]);

  const goPrev = useCallback(() => {
    if (index > 0 && onNavigate) onNavigate(list[index - 1].id);
  }, [index, list, onNavigate]);

  useEffect(() => {
    setTag((photo?.photo_type || "EQUIPMENT").toUpperCase());
  }, [photo]);

  // Preload the immediate neighbours so swiping never shows a blank frame.
  useEffect(() => {
    for (const d of [-1, 1]) {
      const p = list[index + d];
      if (p) prefetchFullImage(p.id);
    }
  }, [index, list]);

  // Desktop keyboard: arrows navigate, Escape closes.
  useEffect(() => {
    if (!photo) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [photo, onClose, goNext, goPrev]);

  const measure = () => {
    const el = imgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width) setImgBox({ w: r.width, h: r.height });
  };

  const changeTag = async (t) => {
    if (!current) return;
    setTag(t);
    try {
      await updatePhoto(current.id, { photo_type: t });
      qc.invalidateQueries({ queryKey: photosQueryKey });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = () => {
    if (!current) return;
    // Advance to the next photo (or previous if deleting the last);
    // close if it was the only one.
    const next =
      (index >= 0 && list[index + 1]) || (index > 0 && list[index - 1]) || null;
    onDelete(current);
    if (next && onNavigate) onNavigate(next.id);
    else onClose();
  };

  // --- Pointer gestures -------------------------------------------------

  const handleTap = (x, y, now) => {
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      if (scale > 1) {
        setScale(1);
        setTx(0);
        setTy(0);
      } else {
        const rect = stageRef.current.getBoundingClientRect();
        const ex = x - (rect.left + rect.width / 2);
        const ey = y - (rect.top + rect.height / 2);
        setScale(DOUBLE_TAP_SCALE);
        setTx(ex * (1 - DOUBLE_TAP_SCALE));
        setTy(ey * (1 - DOUBLE_TAP_SCALE));
      }
    } else {
      lastTap.current = now;
    }
  };

  const onPointerDown = (e) => {
    if (!current) return;
    try {
      stageRef.current.setPointerCapture(e.pointerId);
    } catch {}
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setGesturing(true);

    if (pointers.current.size === 2) {
      const [p1, p2] = [...pointers.current.values()];
      gesture.current = {
        mode: "pinch",
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1,
        midX: (p1.x + p2.x) / 2,
        midY: (p1.y + p2.y) / 2,
        startScale: scale,
        startTx: tx,
        startTy: ty,
      };
    } else if (pointers.current.size === 1) {
      gesture.current = {
        mode: "pan",
        startX: e.clientX,
        startY: e.clientY,
        startTx: tx,
        startTy: ty,
        t: performance.now(),
        moved: false,
      };
    }
  };

  const onPointerMove = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    if (!g) return;

    if (g.mode === "pinch") {
      if (pointers.current.size < 2) return;
      const [p1, p2] = [...pointers.current.values()];
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const s = clamp(g.startScale * (dist / g.dist), 1, MAX_SCALE);
      const rect = stageRef.current.getBoundingClientRect();
      const ex = g.midX - (rect.left + rect.width / 2);
      const ey = g.midY - (rect.top + rect.height / 2);
      setScale(s);
      setTx(g.startTx + ex * (g.startScale - s));
      setTy(g.startTy + ey * (g.startScale - s));
      return;
    }

    if (pointers.current.size > 1) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (!g.moved && Math.hypot(dx, dy) > TAP_SLOP) g.moved = true;

    // Drag always pans the image, clamped to its edges. At zoom 1 the
    // clamp is zero, so the photo stays put.
    const rect = stageRef.current.getBoundingClientRect();
    const maxX = Math.max(0, (imgBox.w * scale - rect.width) / 2);
    const maxY = Math.max(0, (imgBox.h * scale - rect.height) / 2);
    setTx(clamp(g.startTx + dx, -maxX, maxX));
    setTy(clamp(g.startTy + dy, -maxY, maxY));
  };

  const endPointer = (e, cancelled) => {
    const g = gesture.current;
    pointers.current.delete(e.pointerId);

    if (g && g.mode === "pinch") {
      if (pointers.current.size === 1) {
        // One finger lifted mid-pinch: continue as pan (or drag at zoom 1).
        const [p] = [...pointers.current.values()];
        gesture.current = {
          mode: "pan",
          startX: p.x,
          startY: p.y,
          startTx: tx,
          startTy: ty,
          t: performance.now(),
          moved: true,
        };
      } else if (pointers.current.size === 0) {
        gesture.current = null;
        setGesturing(false);
        if (scale < 1.1) {
          setScale(1);
          setTx(0);
          setTy(0);
        }
      }
      return;
    }

    if (pointers.current.size > 0) return;
    gesture.current = null;
    setGesturing(false);
    if (!g) return;

    const now = performance.now();
    if (!g.moved && !cancelled) handleTap(e.clientX, e.clientY, now);
  };

  if (!photo) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex items-center justify-between px-3 h-14 text-white shrink-0">
        <button
          onClick={onClose}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="absolute left-1/2 -translate-x-1/2 text-sm text-white/60 tabular-nums">
          {index >= 0 ? `${index + 1} of ${list.length}` : ""}
        </span>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 px-3 h-9 rounded-full hover:bg-white/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" /> Delete
        </button>
      </div>

      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 flex items-center justify-center p-2 overflow-hidden touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endPointer(e, false)}
        onPointerCancel={(e) => endPointer(e, true)}
      >
        {current && image.src && (
          <img
            ref={imgRef}
            src={image.src}
            onError={image.onError}
            referrerPolicy="no-referrer"
            alt={current.caption || "Photo"}
            draggable={false}
            onLoad={measure}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
              transition: gesturing ? "none" : "transform 0.2s ease-out",
            }}
          />
        )}
        <button
          onClick={goPrev}
          disabled={index <= 0}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Previous photo"
          className="absolute left-2 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white transition-opacity disabled:opacity-30 shrink-0"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={goNext}
          disabled={index < 0 || index >= list.length - 1}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Next photo"
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white transition-opacity disabled:opacity-30 shrink-0"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="px-4 pb-8 pt-3 space-y-3 shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <span className="text-xs text-white/50 shrink-0 mr-1">Tag</span>
          {TAGS.map((t) => (
            <button
              key={t}
              onClick={() => changeTag(t)}
              className={cn(
                "shrink-0 px-2.5 h-7 rounded-full text-[11px] font-medium border transition-colors",
                tag === t
                  ? "bg-white text-neutral-900 border-white"
                  : "text-white/80 border-white/30 hover:border-white/60"
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {current && current.caption && (
          <p className="text-center text-white/90 text-sm">{current.caption}</p>
        )}
      </div>
    </div>
  );
}