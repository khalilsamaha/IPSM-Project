export function getFamilyEnrollmentWhere(familyId:string){return {student:{familyId}} as const;}
/** Legacy-named helper retained for report code; payment UI intentionally uses getFamilyEnrollmentWhere to show settled rows. */
export function getOutstandingEnrollmentWhere(familyId:string){return {remainingCents:{gt:0},student:{familyId}} as const;}
