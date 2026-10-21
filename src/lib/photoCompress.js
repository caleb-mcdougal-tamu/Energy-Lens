// Client-side image compression: resize longest edge to `maxEdge`, re-encode as
// JPEG at `quality`. Decodes via createImageBitmap with an <img> fallback, so
// browsers that can decode the source (incl. HEIC on iOS Safari) get converted
// to JPEG; undecodable files reject and are reported as failed uploads.
export async function compressImage(file, maxEdge = 1600, quality = 0.75) {
  const img = await loadImage(file);
  const longest = Math.max(img.width, img.height);
  const scale = Math.min(1, maxEdge / longest);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  if (img.close) img.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))),
      "image/jpeg",
      quality
    );
  });
  return blob;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (typeof createImageBitmap === "function") {
      createImageBitmap(file)
        .then(resolve)
        .catch(() => {
          loadViaImgElement(file).then(resolve, reject);
        });
    } else {
      loadViaImgElement(file).then(resolve, reject);
    }
  });
}

function loadViaImgElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error("Could not decode image (unsupported format, e.g. HEIC on this browser)")
      );
    };
    img.src = url;
  });
}