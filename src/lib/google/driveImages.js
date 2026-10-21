// Displaying private Drive images. Grid tiles use Drive's thumbnail CDN link
// (fast, resizable via the "=s<px>" suffix); the full-size original is
// downloaded with the user's token and cached as an object URL.
import { useEffect, useState } from "react";
import { downloadBlob } from "@/lib/google/drive";

const MAX_CACHED = 40;
const cache = new Map(); // fileId -> Promise<objectURL> (Map keeps insertion order → LRU)

export function thumbnailUrl(photo, size = 400) {
  const link = photo?.thumbnail_link;
  if (!link) return "";
  return /=s\d+(-c)?$/.test(link) ? link.replace(/=s\d+(-c)?$/, `=s${size}`) : `${link}=s${size}`;
}

export function getFullImageUrl(fileId) {
  if (cache.has(fileId)) {
    const p = cache.get(fileId);
    cache.delete(fileId);
    cache.set(fileId, p);
    return p;
  }
  const p = downloadBlob(fileId).then((blob) => URL.createObjectURL(blob));
  p.catch(() => cache.delete(fileId));
  cache.set(fileId, p);
  while (cache.size > MAX_CACHED) {
    const [oldId, oldP] = cache.entries().next().value;
    cache.delete(oldId);
    // Revoke later so an <img> still showing it isn't blanked mid-render.
    oldP.then((url) => setTimeout(() => URL.revokeObjectURL(url), 30000)).catch(() => {});
  }
  return p;
}

export const prefetchFullImage = (fileId) => {
  getFullImageUrl(fileId).catch(() => {});
};

// Grid thumbnail: CDN thumbnail first; if Drive has none yet (just uploaded)
// or it fails to load, fall back to the downloaded original.
export function useThumbnailSrc(photo, size = 400) {
  const thumb = thumbnailUrl(photo, size);
  const [fallback, setFallback] = useState(null);
  const [useFallback, setUseFallback] = useState(!thumb);

  useEffect(() => {
    setUseFallback(!thumb);
    setFallback(null);
  }, [photo?.id, thumb]);

  useEffect(() => {
    if (!useFallback || !photo?.id) return undefined;
    let alive = true;
    getFullImageUrl(photo.id)
      .then((url) => alive && setFallback(url))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [useFallback, photo?.id]);

  return {
    src: useFallback ? fallback : thumb,
    onError: () => setUseFallback(true),
  };
}

// Viewer image: a large thumbnail shows immediately, then the original
// replaces it once downloaded. Formats the browser can't render (e.g. HEIC
// on Chrome) stay on the thumbnail.
export function useFullImageSrc(photo) {
  const preview = thumbnailUrl(photo, 1600);
  const [full, setFull] = useState(null);
  const [fullFailed, setFullFailed] = useState(false);

  useEffect(() => {
    setFull(null);
    setFullFailed(false);
    if (!photo?.id) return undefined;
    let alive = true;
    getFullImageUrl(photo.id)
      .then((url) => alive && setFull(url))
      .catch(() => alive && setFullFailed(true));
    return () => {
      alive = false;
    };
  }, [photo?.id]);

  return {
    src: full && !fullFailed ? full : preview || null,
    onError: () => {
      if (full) setFullFailed(true);
    },
  };
}
