export type ApplicableCoursePrice = {
  courseId: string;
  levelId: string;
  seasonId: string | null;
  status?: string;
  price?: string;
  priceCents?: number;
};

export function findApplicableCoursePrice<T extends ApplicableCoursePrice>(pricings: T[], courseId: string, levelId: string, seasonId: string | null | undefined): T | undefined {
  const selectedSeasonId = seasonId || null;
  const activeMatches = pricings.filter((pricing) => pricing.status === undefined || pricing.status === "ACTIVE").filter((pricing) => pricing.courseId === courseId && pricing.levelId === levelId);
  return activeMatches.find((pricing) => pricing.seasonId === selectedSeasonId) ?? activeMatches.find((pricing) => pricing.seasonId === null);
}
