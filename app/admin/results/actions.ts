"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { scoreOnePrediction, qualifiesForGrandSlam } from "@/lib/scoring"
import { lookupResult as fetchResult } from "@/lib/footballData"
import { FixtureStatus, ResultSource } from "@/app/generated/prisma/client"
import { requireCommissioner } from "@/lib/adminAuth"
import { transitionDueFixtures, fetchProposals } from "@/lib/resolution"

export type ResultFormState = {
  error?: string
  proposed?: { homeScore: number; awayScore: number }
}

/** Move SCHEDULED fixtures ≥2.5h past kickoff to AWAITING_RESULT and pre-fetch proposals */
export async function checkTransitions(): Promise<void> {
  const { leagueId } = await requireCommissioner()
  await transitionDueFixtures(leagueId)
  await fetchProposals().catch(() => {}) // best-effort; manual lookup remains available
  revalidatePath("/admin/results")
}

/** API lookup — returns proposed score in form state without saving anything */
export async function lookupResult(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const { leagueId } = await requireCommissioner()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  if (!fixtureId) return { error: "Missing fixture ID." }

  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { error: "FOOTBALL_DATA_API_KEY is not configured — use manual entry." }
  }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId, leagueId } })
  if (!fixture) return { error: "Fixture not found." }

  try {
    const result = await fetchResult(
      fixture.homeTeam,
      fixture.awayTeam,
      fixture.competition,
      fixture.round,
      fixture.kickoffTime,
    )
    return { proposed: result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Result lookup failed." }
  }
}

/** Confirm result: save scores, apply scoring to all predictions, check Grand Slam */
export async function confirmResult(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const { leagueId } = await requireCommissioner()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  const homeStr = String(formData.get("homeScore") ?? "").trim()
  const awayStr = String(formData.get("awayScore") ?? "").trim()
  const sourceRaw = String(formData.get("source") ?? "MANUAL")

  if (!fixtureId) return { error: "Missing fixture ID." }
  if (!homeStr || !awayStr) return { error: "Please enter both scores." }
  const homeRaw = Number(homeStr)
  const awayRaw = Number(awayStr)
  if (!Number.isInteger(homeRaw) || !Number.isInteger(awayRaw) || homeRaw < 0 || awayRaw < 0) {
    return { error: "Scores must be non-negative whole numbers." }
  }

  const source = sourceRaw === "AI_CONFIRMED" ? ResultSource.AI_CONFIRMED : ResultSource.MANUAL

  await prisma.$transaction(async (tx) => {
    // 1. Mark fixture complete
    const fixture = await tx.fixture.update({
      where: { id: fixtureId, leagueId },
      data: {
        actualHomeScore: homeRaw,
        actualAwayScore: awayRaw,
        status: FixtureStatus.COMPLETED,
        resultSource: source,
        proposedHomeScore: null,
        proposedAwayScore: null,
      },
    })

    // 2. Score all predictions for this fixture
    const predictions = await tx.prediction.findMany({ where: { fixtureId } })
    await Promise.all(
      predictions.map((p) =>
        tx.prediction.update({
          where: { id: p.id },
          data: {
            pointsAwarded: scoreOnePrediction(
              p.predictedHomeScore,
              p.predictedAwayScore,
              homeRaw,
              awayRaw,
            ),
          },
        }),
      ),
    )

    // 3. Grand Slam — award BonusAward rows once every fixture in the round is done
    const league = await tx.league.findUnique({ where: { id: leagueId } })
    if (!league?.grandSlamEnabled) return

    const roundFixtures = await tx.fixture.findMany({
      where: { leagueId, competition: fixture.competition, round: fixture.round },
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

    // Normalize the whole round to pure base points (also heals any legacy
    // rows from when the bonus was folded into pointsAwarded)
    await Promise.all(
      roundPredictions.map((p) =>
        tx.prediction.update({ where: { id: p.id }, data: { pointsAwarded: basePoints(p) } }),
      ),
    )

    const byUser = new Map<string, typeof roundPredictions>()
    for (const p of roundPredictions) {
      const arr = byUser.get(p.userId) ?? []
      arr.push(p)
      byUser.set(p.userId, arr)
    }

    const qualifying = [...byUser]
      .filter(
        ([, preds]) =>
          preds.length === roundFixtures.length &&
          qualifiesForGrandSlam(preds.map((p) => basePoints(p) > 0)),
      )
      .map(([userId]) => userId)

    const roundKey = { leagueId, competition: fixture.competition, round: fixture.round }
    await tx.bonusAward.deleteMany({ where: { ...roundKey, userId: { notIn: qualifying } } })
    for (const userId of qualifying) {
      await tx.bonusAward.upsert({
        where: { userId_leagueId_competition_round: { userId, ...roundKey } },
        create: { userId, ...roundKey, points: league.grandSlamPoints },
        update: { points: league.grandSlamPoints },
      })
    }
  })

  revalidatePath("/admin/results")
  revalidatePath("/")
  redirect("/admin/results")
}
