import {
  listTypes,
  createType,
  updateType,
  listEquipment,
  createEquipment,
  updateEquipment,
  updateAssessment,
} from "@/api/db";
import { mapLimit } from "@/lib/google/drive";

// Bump when the standard structure changes so existing assessments re-run it.
const STRUCTURE_VERSION = "1";

const STANDARD_TYPE_NAME = "Data Collection";

// The nine standard folder names, in canonical order. sort_order = index + 1.
const STANDARD_NAMES = [
  "Lighting",
  "Motors",
  "Compressed Air",
  "HVAC",
  "Water",
  "Steam",
  "Chiller",
  "Cooling Tower",
  "Pumps",
];
const STANDARD_NAMES_CI = new Set(STANDARD_NAMES.map((n) => n.toLowerCase()));

// Old standard names -> new canonical name (case-insensitive match on input).
const RENAME_FROM = {
  lights: "Lighting",
  compressors: "Compressed Air",
};

function resolveStandardTarget(name) {
  const key = String(name || "").toLowerCase().trim();
  if (!key) return null;
  if (STANDARD_NAMES_CI.has(key))
    return STANDARD_NAMES.find((n) => n.toLowerCase() === key);
  if (RENAME_FROM[key]) return RENAME_FROM[key];
  return null;
}

// Ensure `existing` (records in one scope) contains one is_standard record for
// each of the nine names, renaming/adopting in place and creating any missing.
// Matching is on resolved target name, so an old "Lights" or a user-created
// "Lighting" is adopted as the standard folder instead of being duplicated.
// createFn(name, sortOrder) and updateFn(id, patch) do the persistence; the
// Drive calls run in parallel. Returns true if any change was made. Idempotent.
async function ensureStandardRecords(existing, createFn, updateFn) {
  const ops = [];
  const byTarget = {};
  for (const r of existing) {
    const target = resolveStandardTarget(r.name);
    if (!target) continue;
    const cur = byTarget[target];
    if (!cur || (r.is_standard && !cur.is_standard)) byTarget[target] = r;
  }
  for (let i = 0; i < STANDARD_NAMES.length; i++) {
    const target = STANDARD_NAMES[i];
    const sortOrder = i + 1;
    const rec = byTarget[target];
    if (rec) {
      const needs =
        rec.name !== target || !rec.is_standard || rec.sort_order !== sortOrder;
      if (needs) {
        ops.push(() =>
          updateFn(rec.id, {
            name: target,
            is_standard: true,
            sort_order: sortOrder,
          })
        );
      }
    } else {
      ops.push(() => createFn(target, sortOrder));
    }
  }
  await mapLimit(ops, 5, (op) => op());
  return ops.length > 0;
}

// Idempotently ensures an assessment contains:
//   - the standard "Data Collection" equipment type (is_standard, sort_order 0)
//     with its nine standard equipment folders (sort_order 1..9), and
//   - nine standard top-level equipment types (sort_order 1..9).
// Existing folders matching a standard name (or an old name) are renamed /
// adopted in place rather than duplicated. User-created equipment types are
// renumbered to sort_order 10+ so they always sort below the standard ones.
// Records STRUCTURE_VERSION on the assessment when done so later visits (by
// anyone it's shared with) skip the check. Returns true if anything changed.
export async function ensureStandardStructure(assessmentId) {
  let changed = false;

  const types = await listTypes(assessmentId);

  // 1. Data Collection type (sort_order 0)
  let dc = types.find((t) => t.is_standard && t.name === STANDARD_TYPE_NAME);
  if (!dc) {
    dc = await createType(assessmentId, {
      name: STANDARD_TYPE_NAME,
      is_standard: true,
      sort_order: 0,
    });
    changed = true;
  } else if (dc.sort_order !== 0) {
    await updateType(dc.id, { sort_order: 0 });
    changed = true;
  }

  // 2. Standard equipment folders inside Data Collection (sort_order 1..9)
  // 3. Standard top-level equipment types (sort_order 1..9). Run alongside 2.
  //    The Data Collection type itself is excluded so it can't be adopted.
  const dcEquip = await listEquipment(dc.id);
  const [dcChanged, typesChanged] = await Promise.all([
    ensureStandardRecords(
      dcEquip,
      (name, sortOrder) =>
        createEquipment(dc.id, { name, is_standard: true, sort_order: sortOrder }),
      (id, patch) => updateEquipment(id, patch)
    ),
    ensureStandardRecords(
      types.filter((t) => t.id !== dc.id),
      (name, sortOrder) =>
        createType(assessmentId, { name, is_standard: true, sort_order: sortOrder }),
      (id, patch) => updateType(id, patch)
    ),
  ]);
  if (dcChanged || typesChanged) changed = true;

  // 4. Renumber user-created equipment types to sort_order 10+ so they sort
  //    below the standard ones, preserving their current relative order.
  const allTypes = await listTypes(assessmentId);
  const userTypes = allTypes.filter((t) => !t.is_standard);
  userTypes.sort(
    (a, b) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
      String(a.created_date || "").localeCompare(String(b.created_date || ""))
  );
  const typeUpdates = [];
  let order = 10;
  for (const t of userTypes) {
    if (t.sort_order !== order) typeUpdates.push({ id: t.id, sort_order: order });
    order++;
  }
  if (typeUpdates.length) {
    await mapLimit(typeUpdates, 5, ({ id, sort_order }) => updateType(id, { sort_order }));
    changed = true;
  }

  await updateAssessment(assessmentId, { structure_version: STRUCTURE_VERSION });
  return changed;
}