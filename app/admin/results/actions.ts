"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { scoreOnePrediction, qualifiesForGrandSlam } from "@/lib/scoring"
import { lookupResult } from "@/lib/ai"
import { FixtureStatus, ResultSource } from "@/app/generated/prisma/client"
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/activeLeague"

async function requireCommissioner() {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorised")
  const store = await cookies()
  const leagueId = store.get(ACTIVE_LEAGUE_COOKIE)?.value
  if (!leagueId) throw new Error("No active league")
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  })
  if (membership?.role !== "COMMISSIONER") throw new Error("Unauthorised")
  return { userId: session.user.id, leagueId }
}

export type ResultFormState = {
  error?: string
  proposed?: { homeScore: number; awayScore: number; rawText: string }
}

/** Move SCHEDULED fixtures ≥2.5h past kickoff to AWAITING_RESULT */
export async function checkTransitions(): Promise<void> {
  const { leagueId } = await requireCommissioner()
  const now = new Date()
  const cutoff = new Date(now.getTime() - 2.5 * 60 * 60 * 1000)
  await prisma.fixture.updateMany({
    where: { leagueId, status: FixtureStatus.SCHEDULED, kickoffTime: { lte: cutoff } },
    data: { status: FixtureStatus.AWAITING_RESULT },
  })
  revalidatePath("/admin/results")
}

/** AI lookup — returns proposed score in form state without saving anything */
export async function lookupResultAI(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const { leagueId } = await requireCommissioner()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  if (!fixtureId) return { error: "Missing fixture ID." }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not configured — use manual entry." }
  }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId, leagueId } })
  if (!fixture) return { error: "Fixture not found." }

  try {
    const result = await lookupResult(
      fixture.homeTeam,
      fixture.awayTeam,
      fixture.competition,
      fixture.round,
      fixture.kickoffTime,
    )
    return { proposed: result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "AI lookup failed." }
  }
}

/** Confirm result: save scores, apply scoring to all predictions, check Grand Slam */
export async function confirmResult(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  const { leagueId } = await requireCommissioner()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  const homeRaw = Number(formData.get("homeScore"))
  const awayRaw = Number(formData.get("awayScore"))
  const sourceRaw = String(formData.get("source") ?? "MANUAL")

  if (!fixtureId) return { error: "Missing fixture ID." }
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

    // 3. Grand Slam — only if all fixtures in this league+competition+round are done
    const league = await tx.league.findUnique({ where: { id: leagueId } })
    if (!league?.grandSlamEnabled) return

    const roundFixtures = await tx.fixture.findMany({
      where: { leagueId, competition: fixture.competition, round: fixture.round },
    })
    if (!roundFixtures.every((f) => f.status === FixtureStatus.COMPLETED)) return

    const roundPredictions = await tx.prediction.findMany({
      where: { fixtureId: { in: roundFixtures.map((f) => f.id) } },
    })

    const byUser = new Map<string, typeof roundPredictions>()
    for (const p of roundPredictions) {
      const arr = byUser.get(p.userId) ?? []
      arr.push(p)
      byUser.set(p.userId, arr)
    }

    for (const [, preds] of byUser) {
      if (preds.length < roundFixtures.length) continue
      if (qualifiesForGrandSlam(preds.map((p) => (p.pointsAwarded ?? 0) > 0))) {
        await tx.prediction.update({
          where: { id: preds[0].id },
          data: { pointsAwarded: (preds[0].pointsAwarded ?? 0) + league.grandSlamPoints },
        })
      }
    }
  })

  revalidatePath("/admin/results")
  revalidatePath("/")
  redirect("/admin/results")
}
