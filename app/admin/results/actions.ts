"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { scoreOnePrediction, qualifiesForGrandSlam } from "@/lib/scoring"
import { lookupResult } from "@/lib/ai"
import { FixtureStatus, ResultSource } from "@/app/generated/prisma/client"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.isAdmin) throw new Error("Unauthorised")
}

export type ResultFormState = {
  error?: string
  proposed?: { homeScore: number; awayScore: number; rawText: string }
}

/** Move SCHEDULED fixtures ≥2.5h past kickoff to AWAITING_RESULT */
export async function checkTransitions(): Promise<void> {
  await requireAdmin()
  const cutoff = new Date(Date.now() - 2.5 * 60 * 60 * 1000)
  await prisma.fixture.updateMany({
    where: { status: FixtureStatus.SCHEDULED, kickoffTime: { lte: cutoff } },
    data: { status: FixtureStatus.AWAITING_RESULT },
  })
  revalidatePath("/admin/results")
}

/** AI lookup — returns proposed score in form state without saving anything */
export async function lookupResultAI(
  _prev: ResultFormState,
  formData: FormData,
): Promise<ResultFormState> {
  await requireAdmin()

  const fixtureId = String(formData.get("fixtureId") ?? "")
  if (!fixtureId) return { error: "Missing fixture ID." }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "ANTHROPIC_API_KEY is not configured — use manual entry." }
  }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
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
  await requireAdmin()

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
      where: { id: fixtureId },
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

    // 3. Grand Slam check — only if all fixtures in this competition+round are now done
    const settings = await tx.leagueSettings.findFirst()
    if (!settings?.grandSlamEnabled) return

    const roundFixtures = await tx.fixture.findMany({
      where: { competition: fixture.competition, round: fixture.round },
    })
    if (!roundFixtures.every((f) => f.status === FixtureStatus.COMPLETED)) return

    const roundPredictions = await tx.prediction.findMany({
      where: { fixtureId: { in: roundFixtures.map((f) => f.id) } },
    })

    // Group by user
    const byUser = new Map<string, typeof roundPredictions>()
    for (const p of roundPredictions) {
      const arr = byUser.get(p.userId) ?? []
      arr.push(p)
      byUser.set(p.userId, arr)
    }

    for (const [, preds] of byUser) {
      // User must have predicted every fixture in the round
      if (preds.length < roundFixtures.length) continue
      if (qualifiesForGrandSlam(preds.map((p) => (p.pointsAwarded ?? 0) > 0))) {
        await tx.prediction.update({
          where: { id: preds[0].id },
          data: { pointsAwarded: (preds[0].pointsAwarded ?? 0) + settings.grandSlamPoints },
        })
      }
    }
  })

  revalidatePath("/admin/results")
  revalidatePath("/")
  redirect("/admin/results")
}
