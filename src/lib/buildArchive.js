import { loadAssessmentTree } from "@/api/db";
import { downloadBlob } from "@/lib/google/drive";
import { createZip } from "@/lib/zipWriter";
import { sortEquipmentTypes, sortEquipment } from "@/lib/sortOrder";

const yieldToUI = () => new Promise((r) => setTimeout(r, 0));

// ---- Sanitization (Windows-safe) ----
export function sanitizeName(name, max = 80) {
  let s = String(name ?? "")
    .replace(/[\/\\:*?"<>|]/g, "") // strip forbidden chars
    .replace(/\s+/g, "_") // collapse whitespace -> single underscore
    .replace(/^[.\s_]+/, "") // strip leading dots/spaces/underscores
    .replace(/[.\s_]+$/, "") // strip trailing dots/spaces/underscores
    .slice(0, max)
    .replace(/[.\s_]+$/, "");
  return s || "unnamed";
}

// Make a list of names unique under the same parent (append _2, _3, ...),
// keeping each within `max` chars.
export function dedupeNames(names, max = 80) {
  const seen = new Set();
  return names.map((n) => {
    let cand = n;
    if (!seen.has(cand)) {
      seen.add(cand);
      return cand;
    }
    let i = 2;
    while (true) {
      const suffix = "_" + i;
      let base = n.length + suffix.length > max ? n.slice(0, max - suffix.length) : n;
      cand = base + suffix;
      if (!seen.has(cand)) {
        seen.add(cand);
        return cand;
      }
      i++;
    }
  });
}

// ---- Photo filename segment sanitizer ----
// The underscore is the field delimiter in photo filenames, so segments must
// not contain underscores. Whitespace -> single hyphen, strip forbidden chars
// and remaining punctuation, uppercase, truncate to 24 chars.
function sanitizeSegment(name) {
  let s = String(name ?? "")
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/[\/\\:*?"<>|]/g, "")
    .replace(/[^\w\-]/g, "")
    .toUpperCase()
    .slice(0, 24)
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  return s || "X";
}

// ---- Helpers ----
const sortByCaptured = (arr) =>
  arr
    .slice()
    .sort((a, b) => String(a.captured_at || "").localeCompare(String(b.captured_at || "")));

function seqWidth(count) {
  return Math.max(3, String(count).length);
}

function formatDateForFile(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "00000000-000000";
  const p = (n, l = 2) => String(n).padStart(l, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function photoFilename(segments, p, index, width) {
  const seq = String(index + 1).padStart(width, "0");
  const tag = (p.photo_type || "EQUIPMENT").toUpperCase();
  return `${segments.assessment}_${segments.type}_${segments.equip}_${tag}_${seq}.${photoExtension(p)}`;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function buildCsv(rows) {
  const header = "folder_path,filename,photo_type,caption,captured_at";
  const lines = rows.map((r) =>
    [r.folder_path, r.filename, r.photo_type, r.caption, r.captured_at].map(csvEscape).join(",")
  );
  return header + "\n" + lines.join("\n") + (lines.length ? "\n" : "");
}

async function fetchBytes(fileId) {
  try {
    const blob = await downloadBlob(fileId);
    return new Uint8Array(await blob.arrayBuffer());
  } catch {
    return null;
  }
}

// Keep the original extension for photos imported from Drive (e.g. .png).
function photoExtension(p) {
  const m = String(p.name || "").match(/\.([a-z0-9]{2,5})$/i);
  return m ? m[1].toLowerCase() : "jpg";
}

// ---- Data loading ----
async function loadData(assessment) {
  const tree = await loadAssessmentTree(assessment.id);
  const photos = tree.photos;
  const types = sortEquipmentTypes(tree.types);
  const typePhotos = {};
  const equipPhotos = {};
  for (const p of photos) {
    if (p.equipment_id) (equipPhotos[p.equipment_id] ||= []).push(p);
    else (typePhotos[p.equipment_type_id] ||= []).push(p);
  }
  const equipmentByType = {};
  for (const t of types) {
    equipmentByType[t.id] = sortEquipment(tree.equipmentByType[t.id] || []);
  }
  return { types, photos, typePhotos, equipPhotos, equipmentByType };
}

function computeNaming(data) {
  const typeNames = dedupeNames(data.types.map((t) => sanitizeName(t.name || "Type")));
  const typeNameMap = {};
  data.types.forEach((t, i) => (typeNameMap[t.id] = typeNames[i]));
  const equipNameMap = {};
  for (const t of data.types) {
    const eqs = data.equipmentByType[t.id] || [];
    const names = dedupeNames(eqs.map((e) => sanitizeName(e.name || "Equipment")));
    eqs.forEach((e, i) => (equipNameMap[e.id] = names[i]));
  }
  return { typeNameMap, equipNameMap };
}

function countEquipPhotos(data, typeId) {
  let n = 0;
  for (const eq of data.equipmentByType[typeId] || [])
    n += (data.equipPhotos[eq.id] || []).length;
  return n;
}

async function addPhotoEntries({
  photos,
  folderPath,
  folderDisplay,
  segments,
  entries,
  csvRows,
  processed,
  total,
  onProgress,
}) {
  const sorted = sortByCaptured(photos);
  const w = seqWidth(sorted.length);
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const fn = photoFilename(segments, p, i, w);
    const bytes = await fetchBytes(p.id);
    if (bytes) {
      entries.push({ path: folderPath + fn, data: bytes, deflate: false });
      csvRows.push({
        folder_path: folderDisplay,
        filename: fn,
        photo_type: (p.photo_type || "EQUIPMENT").toUpperCase(),
        caption: p.caption || "",
        captured_at: p.captured_at || "",
      });
    }
    processed += 1;
    onProgress?.(processed, total);
    await yieldToUI();
  }
  return processed;
}

async function buildEntries(assessment, data, naming, { scopeTypeIds, includePdf, includeCsv = true, onProgress }) {
  const rootName = sanitizeName(assessment.name || "Assessment");
  const assessmentSeg = sanitizeSegment(
    assessment.assessment_number && assessment.assessment_number.trim()
      ? assessment.assessment_number
      : assessment.name || "Assessment"
  );
  const entries = [];
  const csvRows = [];
  const scopedTypes = scopeTypeIds
    ? data.types.filter((t) => scopeTypeIds.includes(t.id))
    : data.types;
  const scopePhotoCount = scopeTypeIds
    ? scopedTypes.reduce(
        (s, t) => s + (data.typePhotos[t.id] || []).length + countEquipPhotos(data, t.id),
        0
      )
    : data.photos.length;
  const total = scopePhotoCount + (includePdf && assessment.report_file_id ? 1 : 0);
  let processed = 0;
  onProgress?.(0, total);

  entries.push({ path: rootName + "/", isDir: true });

  for (const t of scopedTypes) {
    const typePhotoTotal =
      (data.typePhotos[t.id] || []).length + countEquipPhotos(data, t.id);
    if (typePhotoTotal === 0) continue;
    const tName = naming.typeNameMap[t.id];
    const typeSeg = sanitizeSegment(t.name || "Type");
    const typePath = `${rootName}/${tName}/`;
    entries.push({ path: typePath, isDir: true });

    processed = await addPhotoEntries({
      photos: data.typePhotos[t.id] || [],
      folderPath: typePath,
      folderDisplay: typePath.replace(/\/$/, ""),
      segments: { assessment: assessmentSeg, type: typeSeg, equip: "GENERAL" },
      entries,
      csvRows,
      processed,
      total,
      onProgress,
    });

    for (const eq of data.equipmentByType[t.id] || []) {
      if (!(data.equipPhotos[eq.id] || []).length) continue;
      const eqName = naming.equipNameMap[eq.id];
      const equipSeg = sanitizeSegment(eq.name || "Equipment");
      const eqPath = `${typePath}${eqName}/`;
      entries.push({ path: eqPath, isDir: true });
      processed = await addPhotoEntries({
        photos: data.equipPhotos[eq.id] || [],
        folderPath: eqPath,
        folderDisplay: eqPath.replace(/\/$/, ""),
        segments: { assessment: assessmentSeg, type: typeSeg, equip: equipSeg },
        entries,
        csvRows,
        processed,
        total,
        onProgress,
      });
    }
  }

  if (includeCsv) {
    entries.push({
      path: "captions.csv",
      data: new TextEncoder().encode(buildCsv(csvRows)),
      deflate: true,
    });
  }

  // Most recently generated PDF, if present
  if (includePdf && assessment.report_file_id) {
    const bytes = await fetchBytes(assessment.report_file_id);
    if (bytes) entries.push({ path: `${rootName}-report.pdf`, data: bytes, deflate: false });
    processed += 1;
    onProgress?.(processed, total);
  }

  return entries;
}

/**
 * Build a ZIP archive recreating the assessment hierarchy as nested folders.
 * split: true -> one zip per equipment type (returns results[]).
 * onProgress: (current, total) called as photos are fetched/embedded.
 */
export async function buildArchive(assessment, { onProgress, split = false } = {}) {
  const data = await loadData(assessment);
  const naming = computeNaming(data);
  const rootName = sanitizeName(assessment.name || "Assessment");

  if (split) {
    const total = data.photos.length;
    let running = 0;
    const results = [];
    for (const t of data.types) {
      const tName = naming.typeNameMap[t.id];
      const entries = await buildEntries(assessment, data, naming, {
        scopeTypeIds: [t.id],
        includePdf: false,
        onProgress: (c) => onProgress?.(running + c, total),
      });
      const blob = await createZip(entries);
      results.push({ blob, filename: `${rootName}-${tName}.zip` });
      running += (data.typePhotos[t.id] || []).length + countEquipPhotos(data, t.id);
    }
    onProgress?.(total, total);
    return { split: true, results };
  }

  const entries = await buildEntries(assessment, data, naming, {
    scopeTypeIds: null,
    includePdf: true,
    onProgress: (c, t) => onProgress?.(c, t),
  });
  const blob = await createZip(entries);
  return { split: false, blob, filename: `${rootName}.zip` };
}
