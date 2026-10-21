import { loadAssessmentTree, deleteAssessment } from "@/api/db";

// Load the counts needed for the confirmation dialog.
export async function loadAssessmentDeleteContext(assessmentId) {
  const { types, photos } = await loadAssessmentTree(assessmentId);
  return { typeCount: types.length, photoCount: photos.length };
}

// Moving the assessment folder to the Drive trash takes everything under it
// with it, including the standard (Data Collection) folders — the is_standard
// protection only hides individual delete controls in the UI.
export async function deleteAssessmentCascade(assessmentId) {
  await deleteAssessment(assessmentId);
}
