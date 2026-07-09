import { prisma } from "@/lib/prisma"

/**
 * Upserts the user's prediction for a canonical fixture. Fixtures are shared
 * across every league on the competition, so one prediction per user per
 * fixture covers all their leagues — no sync needed.
 * Deadline/membership checks are the caller's responsibility.
 */
export async function upsertPrediction(
  userId: string,
  fixtureId: string,
  home: number,
  away: number,
  submittedVia: "WEB" | "API",
) {
  return prisma.prediction.upsert({
    where: { userId_fixtureId: { userId, fixtureId } },
    create: {
      userId,
      fixtureId,
      predictedHomeScore: home,
      predictedAwayScore: away,
      submittedVia,
    },
    update: { predictedHomeScore: home, predictedAwayScore: away },
  })
}
