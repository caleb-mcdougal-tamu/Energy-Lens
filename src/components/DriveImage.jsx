import React from "react";
import { useThumbnailSrc } from "@/lib/google/driveImages";
import { cn } from "@/lib/utils";

// Thumbnail of a private Google Drive image (see lib/google/driveImages.js).
export default function DriveImage({ photo, size = 400, className, alt = "" }) {
  const { src, onError } = useThumbnailSrc(photo, size);
  if (!src) return <span className={cn("block bg-neutral-100 animate-pulse", className)} />;
  return (
    <img
      src={src}
      onError={onError}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      draggable={false}
      className={className}
    />
  );
}
