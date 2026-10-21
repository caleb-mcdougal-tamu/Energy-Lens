// Energy Lens data layer. Everything lives in Google Drive; there is no
// database or server:
//
//   Energy Lens/                  root folder in the creator's My Drive
//     <Assessment>/               folder, properties.el_kind = "assessment"
//       <Equipment type>/         any subfolder (except Exports)
//         photo.jpg               type-level photo
//         <Equipment>/            any subfolder of a type
//           photo.jpg
//       Exports/                  generated PDF reports (el_kind = "exports")
//
// Record fields (photo tag, sort order, site, ...) are stored as public Drive
// file `properties`, so anyone the assessment folder is shared with sees the
// same data. Records use the Drive file ID as their `id`. Deleting moves
// folders/files to the Drive trash.
import {
  FOLDER_MIME,
  listFiles,
  listChildren,
  getFile,
  createFolder,
  updateFile,
  trashFile,
  copyFile,
  uploadFile,
  toProperties,
  mapLimit,
  folderUrl,
  fileUrl,
} from "@/lib/google/drive";

const ROOT_NAME = "Energy Lens";
const EXPORTS_NAME = "Exports";
const IMAGE_QUERY = "mimeType contains 'image/'";
const FOLDER_QUERY = `mimeType = '${FOLDER_MIME}'`;

const props = (f) => f.properties || {};
const num = (v) => (v === undefined || v === null || v === "" ? undefined : Number(v));
const bool = (v) => v === "true";

// EXIF time from Drive looks like "2024:05:01 13:45:10".
function exifToIso(t) {
  if (!t) return null;
  const m = String(t).match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ---- Mappers -------------------------------------------------------------

function toAssessment(f) {
  const p = props(f);
  const owner = f.owners?.[0];
  return {
    id: f.id,
    name: f.name,
    site_location: p.site_location || "",
    assessment_date: p.assessment_date || "",
    assessment_number: p.assessment_number || "",
    created_by: p.created_by || owner?.emailAddress || "",
    created_date: f.createdTime,
    report_file_id: p.report_file_id || "",
    report_file_url: p.report_file_id ? fileUrl(p.report_file_id) : "",
    structure_version: p.structure_version || "",
    shared: owner ? !owner.me : true,
    drive_url: folderUrl(f.id),
  };
}

function toType(f, assessmentId) {
  const p = props(f);
  return {
    id: f.id,
    assessment_id: assessmentId,
    name: f.name,
    is_standard: bool(p.is_standard),
    sort_order: num(p.sort_order),
    created_date: f.createdTime,
  };
}

function toEquipment(f, typeId) {
  const p = props(f);
  return {
    id: f.id,
    equipment_type_id: typeId,
    name: f.name,
    notes: f.description || "",
    is_standard: bool(p.is_standard),
    sort_order: num(p.sort_order),
    created_date: f.createdTime,
  };
}

function toPhoto(f, { assessmentId, typeId, equipmentId }) {
  const p = props(f);
  return {
    id: f.id,
    assessment_id: assessmentId,
    equipment_type_id: typeId,
    equipment_id: equipmentId || null,
    name: f.name,
    mime_type: f.mimeType,
    photo_type: (p.photo_type || "EQUIPMENT").toUpperCase(),
    caption: f.description || "",
    captured_at: p.captured_at || exifToIso(f.imageMediaMetadata?.time) || f.createdTime,
    created_date: f.createdTime,
    thumbnail_link: f.thumbnailLink || "",
    drive_url: f.webViewLink || fileUrl(f.id),
  };
}

const parentIn = (f, ids) => (f.parents || []).find((id) => ids.has(id));

// ---- Root folder ---------------------------------------------------------

let rootPromise = null;

async function findOrCreateRoot() {
  const found = await listFiles(
    `${FOLDER_QUERY} and trashed = false and 'me' in owners and properties has { key='el_kind' and value='root' }`,
    { fields: "id,createdTime" }
  );
  if (found.length) {
    found.sort((a, b) => a.createdTime.localeCompare(b.createdTime));
    return found[0].id;
  }
  const f = await createFolder(ROOT_NAME, "root", { properties: { el_kind: "root" } });
  return f.id;
}

function getRootFolderId() {
  if (!rootPromise) {
    rootPromise = findOrCreateRoot().catch((e) => {
      rootPromise = null;
      throw e;
    });
  }
  return rootPromise;
}

export function resetDriveCache() {
  rootPromise = null;
}

// ---- Assessments -----------------------------------------------------------

// Every assessment folder the user can see: their own plus any shared with
// them (directly or via a shared drive). Newest first.
export async function listAssessments() {
  const files = await listFiles(
    `${FOLDER_QUERY} and trashed = false and properties has { key='el_kind' and value='assessment' }`
  );
  return files
    .map(toAssessment)
    .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
}

export async function getAssessment(id) {
  return toAssessment(await getFile(id));
}

export async function createAssessment({ name, site_location, assessment_date, created_by }) {
  const root = await getRootFolderId();
  const f = await createFolder(name, root, {
    properties: { el_kind: "assessment", site_location, assessment_date, created_by },
  });
  return toAssessment(f);
}

export async function updateAssessment(id, patch) {
  const { name, ...rest } = patch;
  const meta = {};
  if (name !== undefined) meta.name = name;
  if (Object.keys(rest).length) meta.properties = toProperties(rest);
  return toAssessment(await updateFile(id, meta));
}

export function deleteAssessment(id) {
  return trashFile(id);
}

// ---- Equipment types ---------------------------------------------------------

export async function listTypes(assessmentId) {
  const files = await listChildren([assessmentId], FOLDER_QUERY);
  return files.filter((f) => props(f).el_kind !== "exports").map((f) => toType(f, assessmentId));
}

export async function getType(id) {
  const f = await getFile(id);
  return toType(f, f.parents?.[0]);
}

export async function createType(assessmentId, { name, is_standard = false, sort_order }) {
  const f = await createFolder(name, assessmentId, {
    properties: { el_kind: "type", is_standard: String(!!is_standard), sort_order },
  });
  return toType(f, assessmentId);
}

function folderPatch(patch) {
  const { name, notes, ...rest } = patch;
  const meta = {};
  if (name !== undefined) meta.name = name;
  if (notes !== undefined) meta.description = notes;
  const p = {};
  if (rest.is_standard !== undefined) p.is_standard = String(!!rest.is_standard);
  if (rest.sort_order !== undefined) p.sort_order = rest.sort_order;
  if (Object.keys(p).length) meta.properties = toProperties(p);
  return meta;
}

export async function updateType(id, patch) {
  const f = await updateFile(id, folderPatch(patch));
  return toType(f, f.parents?.[0]);
}

export function deleteType(id) {
  return trashFile(id);
}

// ---- Equipment -------------------------------------------------------------

export async function listEquipment(typeId) {
  const files = await listChildren([typeId], FOLDER_QUERY);
  return files.map((f) => toEquipment(f, typeId));
}

export async function getEquipment(id) {
  const f = await getFile(id);
  return toEquipment(f, f.parents?.[0]);
}

export async function createEquipment(typeId, { name, is_standard = false, sort_order }) {
  const f = await createFolder(name, typeId, {
    properties: { el_kind: "equipment", is_standard: String(!!is_standard), sort_order },
  });
  return toEquipment(f, typeId);
}

export async function updateEquipment(id, patch) {
  const f = await updateFile(id, folderPatch(patch));
  return toEquipment(f, f.parents?.[0]);
}

export function deleteEquipment(id) {
  return trashFile(id);
}

// ---- Whole assessment tree ---------------------------------------------------

// Loads types, equipment and photos for an assessment in three Drive queries.
// Images dropped straight into these folders from Drive show up too (tagged
// EQUIPMENT until retagged in the app).
export async function loadAssessmentTree(assessmentId) {
  const types = await listTypes(assessmentId);
  const typeIds = new Set(types.map((t) => t.id));
  const eqFiles = typeIds.size ? await listChildren([...typeIds], FOLDER_QUERY) : [];
  const equipment = eqFiles.map((f) => toEquipment(f, parentIn(f, typeIds)));
  const eqToType = Object.fromEntries(equipment.map((e) => [e.id, e.equipment_type_id]));
  const folderIds = new Set([...typeIds, ...equipment.map((e) => e.id)]);
  const photoFiles = folderIds.size ? await listChildren([...folderIds], IMAGE_QUERY) : [];
  const photos = photoFiles
    .map((f) => {
      const parent = parentIn(f, folderIds);
      const equipmentId = eqToType[parent] ? parent : null;
      const typeId = equipmentId ? eqToType[parent] : parent;
      return toPhoto(f, { assessmentId, typeId, equipmentId });
    })
    .sort((a, b) => String(b.created_date).localeCompare(String(a.created_date)));
  const equipmentByType = {};
  for (const e of equipment) (equipmentByType[e.equipment_type_id] ||= []).push(e);
  return { types, equipment, equipmentByType, photos };
}

export async function listPhotos(assessmentId) {
  return (await loadAssessmentTree(assessmentId)).photos;
}

// ---- Photos ------------------------------------------------------------------

export async function uploadPhoto(blob, { name, typeId, equipmentId, photo_type, captured_at }) {
  return uploadFile(blob, {
    name,
    mimeType: blob.type || "image/jpeg",
    parents: [equipmentId || typeId],
    properties: toProperties({ el_kind: "photo", photo_type, captured_at }),
  });
}

// Copies photos the user picked from anywhere in their Drive into the
// type/equipment folder; the originals are left untouched.
export async function importDrivePhotos(files, { typeId, equipmentId, photo_type, onProgress }) {
  let done = 0;
  const failed = [];
  await mapLimit(files, 3, async (f) => {
    try {
      await copyFile(f.id, {
        name: f.name,
        parents: [equipmentId || typeId],
        properties: toProperties({
          el_kind: "photo",
          photo_type,
          captured_at: exifToIso(f.imageMediaMetadata?.time) || f.createdTime,
        }),
      });
    } catch (e) {
      failed.push({ name: f.name, error: e?.message || "failed" });
    }
    onProgress?.(++done, files.length);
  });
  return { failed };
}

export async function updatePhoto(id, { photo_type, caption }) {
  const meta = {};
  if (photo_type !== undefined) meta.properties = toProperties({ photo_type });
  if (caption !== undefined) meta.description = caption;
  return updateFile(id, meta);
}

export async function updatePhotos(ids, patch) {
  await mapLimit(ids, 4, (id) => updatePhoto(id, patch));
}

export function deletePhoto(id) {
  return trashFile(id);
}

// ---- Exports -------------------------------------------------------------------

async function getExportsFolderId(assessmentId) {
  const found = await listChildren(
    [assessmentId],
    `${FOLDER_QUERY} and properties has { key='el_kind' and value='exports' }`,
    { fields: "id" }
  );
  if (found.length) return found[0].id;
  const f = await createFolder(EXPORTS_NAME, assessmentId, { properties: { el_kind: "exports" } });
  return f.id;
}

// Saves a generated report PDF into the assessment's Exports folder and
// remembers it as the latest report (the previous one goes to the trash).
export async function saveReport(assessment, blob, filename) {
  const parent = await getExportsFolderId(assessment.id);
  const f = await uploadFile(blob, { name: filename, mimeType: "application/pdf", parents: [parent] });
  const previous = assessment.report_file_id;
  const updated = await updateAssessment(assessment.id, { report_file_id: f.id });
  if (previous && previous !== f.id) await trashFile(previous).catch(() => {});
  return updated;
}

