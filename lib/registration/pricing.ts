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

/** Calculates exclusively in integer cents; Math.round defines the half-up boundary. */
export function calculateSessionBasedFeeCents(configuredPriceCents: number, plannedSessionCount: number, priceBaseSessionCount: number) {
  if (![configuredPriceCents, plannedSessionCount, priceBaseSessionCount].every(Number.isInteger)) throw new Error("Pricing values must be integer cents and session counts.");
  if (configuredPriceCents < 0 || plannedSessionCount < 0 || priceBaseSessionCount <= 0) throw new Error("Pricing values cannot be negative and package sessions must be positive.");
  return Math.round(configuredPriceCents * plannedSessionCount / priceBaseSessionCount);
}
