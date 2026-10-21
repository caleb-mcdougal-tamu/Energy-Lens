// Shared ordering helpers for equipment types and equipment.
//
// Equipment types: the standard "Data Collection" type (is_standard=true) is
// always first, then sort_order ascending, then creation date.
//
// Equipment: sort_order ascending within its parent type, then creation date.

const byCreated = (a, b) =>
  String(a.created_date || "").localeCompare(String(b.created_date || ""));

export function sortEquipmentTypes(types) {
  return (types || []).slice().sort((a, b) => {
    const aStd = a.is_standard ? 0 : 1;
    const bStd = b.is_standard ? 0 : 1;
    if (aStd !== bStd) return aStd - bStd;
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return byCreated(a, b);
  });
}

export function sortEquipment(equipment) {
  return (equipment || []).slice().sort((a, b) => {
    const ao = a.sort_order ?? 0;
    const bo = b.sort_order ?? 0;
    if (ao !== bo) return ao - bo;
    return byCreated(a, b);
  });
}