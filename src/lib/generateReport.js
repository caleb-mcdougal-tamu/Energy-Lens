import { jsPDF } from "jspdf";
import { format, parseISO } from "date-fns";
import { loadAssessmentTree } from "@/api/db";
import { downloadBlob } from "@/lib/google/drive";
import { thumbnailUrl } from "@/lib/google/driveImages";
import { sortEquipmentTypes, sortEquipment } from "@/lib/sortOrder";

const PAGE = { w: 595.28, h: 841.89 };
const MARGIN = 40;
const PHOTO_TOPS = [50, 410]; // y origins for the two stacked photos per page
const PHOTO_BOX = { w: PAGE.w - 2 * MARGIN, h: 300 };

const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

const sortByCaptured = (arr) =>
  arr
    .slice()
    .sort((a, b) => String(a.captured_at || "").localeCompare(String(b.captured_at || "")));

const TAG_ORDER = ["NAMEPLATE", "DATACOLLECTION", "SCREEN", "MEASUREMENT", "LOGGER", "EQUIPMENT", "TEAM"];

function groupByTag(list) {
  const map = {};
  for (const p of list) {
    const tag = (p.photo_type || "EQUIPMENT").toUpperCase();
    (map[tag] ||= []).push(p);
  }
  return TAG_ORDER.filter((t) => map[t] && map[t].length).map((t) => ({ tag: t, photos: map[t] }));
}

function fit(natW, natH, boxW, boxH) {
  const r = Math.min(boxW / natW, boxH / natH);
  return { w: natW * r, h: natH * r };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

function dimsOf(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = dataUrl;
  });
}

function formatOf(dataUrl) {
  if (dataUrl.startsWith("data:image/png")) return "PNG";
  return "JPEG";
}

// Primary: download the original from Drive -> dataURL (no re-encode) for
// JPEG/PNG. Fallback (other formats, e.g. HEIC): Drive's large thumbnail via
// <img crossOrigin> + canvas re-encode to JPEG. Throws if both fail.
async function loadPhoto(p) {
  let dataUrl;
  try {
    if (!/^image\/(jpeg|png)$/.test(p.mime_type || "image/jpeg")) throw new Error("unsupported format");
    const blob = await downloadBlob(p.id);
    if (!blob.type || !blob.type.startsWith("image/")) throw new Error("not an image");
    dataUrl = await blobToDataUrl(blob);
  } catch {
    const url = thumbnailUrl(p, 1600);
    if (!url) throw new Error("no thumbnail");
    dataUrl = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve(c.toDataURL("image/jpeg", 0.85));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => reject(new Error("image load failed"));
      img.src = url;
    });
  }
  const dims = await dimsOf(dataUrl);
  return { dataUrl, dims, format: formatOf(dataUrl) };
}

/**
 * Builds a hierarchical PDF report for an assessment. Processes images
 * sequentially with UI yields so 100+ photos stay responsive (batched, not one
 * blocking pass). onProgress receives { current, total } per photo processed.
 */
export async function generateReport(assessment, onProgress) {
  const tree = await loadAssessmentTree(assessment.id);
  const photos = tree.photos;
  const types = sortEquipmentTypes(tree.types);

  const typePhotos = {};
  const equipPhotos = {};
  for (const p of photos) {
    const bucket = p.equipment_id ? equipPhotos : typePhotos;
    const key = p.equipment_id || p.equipment_type_id;
    (bucket[key] ||= []).push(p);
  }

  const equipmentByType = {};
  for (const t of types) {
    equipmentByType[t.id] = sortEquipment(tree.equipmentByType[t.id] || []);
  }

  const total = photos.length;
  let processed = 0;
  const report = (cur) => onProgress && onProgress({ current: cur, total });

  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const name = assessment.name || "Assessment";

  const footer = (num) => {
    pdf.setFontSize(8);
    pdf.setTextColor(130);
    pdf.text(name, MARGIN, PAGE.h - 22);
    pdf.text(`Page ${num}`, PAGE.w - MARGIN, PAGE.h - 22, { align: "right" });
  };
  const newPage = () => {
    pdf.addPage();
    footer(pdf.getNumberOfPages());
  };

  // ---- Title page (page 1, no footer) ----
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(30);
  pdf.setTextColor(20);
  pdf.text(name, PAGE.w / 2, 300, { align: "center", maxWidth: PAGE.w - 2 * MARGIN });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.setTextColor(80);
  let y = 345;
  if (assessment.site_location) {
    pdf.text(assessment.site_location, PAGE.w / 2, y, {
      align: "center",
      maxWidth: PAGE.w - 2 * MARGIN,
    });
    y += 26;
  }
  if (assessment.assessment_date) {
    pdf.text(format(parseISO(assessment.assessment_date), "MMMM d, yyyy"), PAGE.w / 2, y, {
      align: "center",
    });
    y += 26;
  }
  pdf.setTextColor(120);
  pdf.text(`${total} ${total === 1 ? "photo" : "photos"}`, PAGE.w / 2, y, { align: "center" });

  const drawPhoto = async (p, top) => {
    try {
      const loaded = await loadPhoto(p);
      const f = fit(loaded.dims.w, loaded.dims.h, PHOTO_BOX.w, PHOTO_BOX.h);
      const x = MARGIN + (PHOTO_BOX.w - f.w) / 2;
      const yy = top + (PHOTO_BOX.h - f.h) / 2;
      pdf.addImage(loaded.dataUrl, loaded.format, x, yy, f.w, f.h);
    } catch {
      pdf.setFontSize(11);
      pdf.setTextColor(150);
      pdf.text("[image unavailable]", PAGE.w / 2, top + PHOTO_BOX.h / 2, { align: "center" });
    }
    if (p.caption) {
      pdf.setFontSize(10);
      pdf.setTextColor(60);
      pdf.text(p.caption, PAGE.w / 2, top + PHOTO_BOX.h + 18, {
        align: "center",
        maxWidth: PHOTO_BOX.w,
      });
    }
  };

  const drawPhotoGroup = async (list, subheading) => {
    const sorted = sortByCaptured(list);
    for (let i = 0; i < sorted.length; i += 2) {
      newPage();
      const withHeading = i === 0 && subheading;
      const tops = withHeading ? [90, 440] : PHOTO_TOPS;
      if (withHeading) {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.setTextColor(60);
        pdf.text(subheading, MARGIN, 60);
      }
      const pair = sorted.slice(i, i + 2);
      for (let s = 0; s < pair.length; s++) {
        await drawPhoto(pair[s], tops[s]);
        processed += 1;
        report(processed);
        await yieldToUI();
      }
    }
  };

  const drawTagGroups = async (list) => {
    for (const g of groupByTag(list)) {
      await drawPhotoGroup(g.photos, g.tag);
    }
  };

  for (const t of types) {
    const typeTotal =
      (typePhotos[t.id] || []).length +
      (equipmentByType[t.id] || []).reduce(
        (s, eq) => s + (equipPhotos[eq.id] || []).length,
        0
      );
    if (typeTotal === 0) continue;
    // Equipment type section header (own page)
    newPage();
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(36);
    pdf.setTextColor(20);
    pdf.text(t.name || "", PAGE.w / 2, PAGE.h / 2, {
      align: "center",
      maxWidth: PAGE.w - 2 * MARGIN,
    });

    // Type-level photos, grouped by tag
    await drawTagGroups(typePhotos[t.id] || []);

    // Then each equipment
    for (const eq of equipmentByType[t.id]) {
      if (!(equipPhotos[eq.id] || []).length) continue;
      newPage();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(24);
      pdf.setTextColor(20);
      pdf.text(eq.name || "", PAGE.w / 2, PAGE.h / 2 - 30, {
        align: "center",
        maxWidth: PAGE.w - 2 * MARGIN,
      });
      if (eq.notes) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.setTextColor(80);
        const lines = pdf.splitTextToSize(eq.notes, PAGE.w - 2 * MARGIN);
        pdf.text(lines, PAGE.w / 2, PAGE.h / 2 + 10, { align: "center" });
      }
      await drawTagGroups(equipPhotos[eq.id] || []);
    }
  }

  return pdf.output("blob");
}