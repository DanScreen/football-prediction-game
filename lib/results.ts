import { prisma } from "@/lib/prisma"
import { scoreOnePrediction, qualifiesForGrandSlam, awardedPoints } from "@/lib/scoring"
import { FixtureStatus, ResultSource } from "@/app/generated/prisma/client"

/**
 * Confirm a canonical fixture's result: save scores, mark COMPLETED, score all
 * predictions once (predictions are global), then fan Grand Slam bonuses out
 * to every subscribing league once the round is complete — each league has its
 * own grandSlamEnabled/points and its own member set.
 */
export async function confirmFixtureResult(
  fixtureId: string,
  homeScore: number,
  awayScore: number,
  source: ResultSource,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Mark fixture complete
    const fixture = await tx.fixture.update({
      where: { id: fixtureId },
      data: {
        actualHomeScore: homeScore,
        actualAwayScore: awayScore,
        status: FixtureStatus.COMPLETED,
        resultSource: source,
        proposedHomeScore: null,
        proposedAwayScore: null,
      },
    })

    // 2. Score all predictions for this fixture (once, globally)
    const predictions = await tx.prediction.findMany({ where: { fixtureId } })
    await Promise.all(
      predictions.map((p) =>
        tx.prediction.update({
          where: { id: p.id },
          data: {
            pointsAwarded: awardedPoints(
              scoreOnePrediction(
                p.predictedHomeScore,
                p.predictedAwayScore,
                homeScore,
                awayScore,
              ),
              p.isBanker,
            ),
          },
        }),
      ),
    )

    // 3. Grand Slam — once every fixture in the round is done, award per league
    const roundFixtures = await tx.fixture.findMany({
      where: { competitionId: fixture.competitionId, round: fixture.round },
    })
    if (!roundFixtures.every((f) => f.status === FixtureStatus.COMPLETED)) return

    const roundPredictions = await tx.prediction.findMany({
      where: { fixtureId: { in: roundFixtures.map((f) => f.id) } },
    })

    const fixtureById = new Map(roundFixtures.map((f) => [f.id, f]))
    const basePoints = (p: (typeof roundPredictions)[number]) => {
      const f = fixtureById.get(p.fixtureId)!
      return scoreOnePrediction(
        p.predictedHomeScore,
        p.predictedAwayScore,
        f.actualHomeScore!,
        f.actualAwayScore!,
      )
    }

    // Re-derive the whole round's points (heals any legacy rows). Banker
    // doubling is re-applied here — normalising to *base* points would silently
    // strip it from every fixture in the round the moment the round completed.
    await Promise.all(
      roundPredictions.map((p) =>
        tx.prediction.update({
          where: { id: p.id },
          data: { pointsAwarded: awardedPoints(basePoints(p), p.isBanker) },
        }),
      ),
    )

    const byUser = new Map<string, typeof roundPredictions>()
    for (const p of roundPredictions) {
      const arr = byUser.get(p.userId) ?? []
      arr.push(p)
      byUser.set(p.userId, arr)
    }

    // Users who predicted every round fixture with a correct result each time
    const qualifyingUserIds = new Set(
      [...byUser]
        .filter(
          ([, preds]) =>
            preds.length === roundFixtures.length &&
            qualifiesForGrandSlam(preds.map((p) => basePoints(p) > 0)),
        )
        .map(([userId]) => userId),
    )

    // Fan out per subscribing league: a member qualifies for a league's bonus
    // only in leagues they belong to
    const leagues = await tx.league.findMany({
      where: { competitionId: fixture.competitionId, grandSlamEnabled: true },
      include: { memberships: { select: { userId: true } } },
    })

    for (const league of leagues) {
      const memberIds = league.memberships.map((m) => m.userId)
      const qualifying = memberIds.filter((id) => qualifyingUserIds.has(id))
      const roundKey = { leagueId: league.id, round: fixture.round }

      await tx.bonusAward.deleteMany({
        where: { ...roundKey, userId: { notIn: qualifying } },
      })
      for (const userId of qualifying) {
        await tx.bonusAward.upsert({
          where: { userId_leagueId_round: { userId, ...roundKey } },
          create: { userId, ...roundKey, points: league.grandSlamPoints },
          update: { points: league.grandSlamPoints },
        })
      }
    }
  })
}

/**
 * Confirm every AWAITING_RESULT fixture that has a proposed score — the host's
 * "Accept All" button. Failures are isolated per fixture so one bad row
 * doesn't abort the batch.
 */
export async function acceptAllProposed(): Promise<{ confirmed: number; failed: number }> {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: FixtureStatus.AWAITING_RESULT,
      proposedHomeScore: { not: null },
      proposedAwayScore: { not: null },
    },
    select: { id: true, proposedHomeScore: true, proposedAwayScore: true },
  })

  let confirmed = 0
  let failed = 0
  for (const f of fixtures) {
    try {
      await confirmFixtureResult(
        f.id,
        f.proposedHomeScore!,
        f.proposedAwayScore!,
        ResultSource.AI_CONFIRMED,
      )
      confirmed++
    } catch {
      failed++
    }
  }
  return { confirmed, failed }
}
