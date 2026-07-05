import { prisma } from "@/lib/prisma"

type FixtureForSync = {
  id: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
}

/**
 * Upserts the user's prediction for a fixture, then copies it to matching
 * fixtures (same teams + kickoff) in the user's other leagues per the spec.
 * Deadline/membership checks are the caller's responsibility.
 */
export async function upsertPredictionWithSync(
  userId: string,
  fixture: FixtureForSync,
  home: number,
  away: number,
  submittedVia: "WEB" | "API",
) {
  const prediction = await prisma.prediction.upsert({
    where: { userId_fixtureId: { userId, fixtureId: fixture.id } },
    create: {
      userId,
      fixtureId: fixture.id,
      predictedHomeScore: home,
      predictedAwayScore: away,
      submittedVia,
    },
    update: { predictedHomeScore: home, predictedAwayScore: away },
  })

  const leagueIds = (
    await prisma.leagueMembership.findMany({ where: { userId }, select: { leagueId: true } })
  ).map((m) => m.leagueId)

  if (leagueIds.length > 1) {
    const matchingFixtures = await prisma.fixture.findMany({
      where: {
        leagueId: { in: leagueIds },
        id: { not: fixture.id },
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        kickoffTime: fixture.kickoffTime,
        status: "SCHEDULED",
      },
    })

    await Promise.all(
      matchingFixtures.map((f) =>
        prisma.prediction.upsert({
          where: { userId_fixtureId: { userId, fixtureId: f.id } },
          create: {
            userId,
            fixtureId: f.id,
            predictedHomeScore: home,
            predictedAwayScore: away,
            submittedVia,
          },
          update: { predictedHomeScore: home, predictedAwayScore: away },
        }),
      ),
    )
  }

  return prediction
}
