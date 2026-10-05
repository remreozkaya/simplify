const PROFILE_FIELDS = ['version', 'name', 'surname', 'birthdate', 'nickname', 'profileUpdatedAt'] as const;
const ENROLLMENT_FIELDS = [
  'id', 'type', 'facultyId', 'facultyName', 'educationLevel', 'planType',
  'programCode', 'programName', 'programNameTr', 'programNameEn',
  'curriculumPlanId', 'curriculumPlanName', 'curriculumPlanNameTr', 'curriculumPlanNameEn',
  'primaryProgramCode', 'targetProgramCode', 'selectionRequiresReview',
] as const;
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function pickScalars(record: Record<string, unknown>, fields: readonly string[]) {
  const result: Record<string, unknown> = {};
  for (const key of fields) {
    const value = record[key];
    if (Object.hasOwn(record, key) && (value === null || ['string', 'number', 'boolean'].includes(typeof value))) result[key] = value;
  }
  return result;
}
/** Preserve saved versions/values: UI repair/migration is inappropriate for access exports. */
export function exportStoredProfile(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const result = pickScalars(value, PROFILE_FIELDS);
  if (Array.isArray(value.programEnrollments)) {
    result.programEnrollments = value.programEnrollments.filter(isRecord).map(enrollment => {
      const fields = pickScalars(enrollment, ENROLLMENT_FIELDS);
      if (Array.isArray(enrollment.associatedPrimaryProgramCodes)) fields.associatedPrimaryProgramCodes = enrollment.associatedPrimaryProgramCodes.filter(code => typeof code === 'string');
      return fields;
    });
  }
  return result;
}
