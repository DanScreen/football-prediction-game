"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { upsertPrediction as savePrediction } from "@/lib/predictions"
import { setBanker } from "@/lib/banker"

export type PredictionState = { error?: string; success?: boolean }
export type BankerState = { error?: string }

async function saveScoresForUser(
  userId: string,
  fixtureId: string,
  home: number,
  away: number,
): Promise<PredictionState> {
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  if (!fixture) return { error: "Fixture not found." }

  const membership = await prisma.leagueMembership.findFirst({
    where: { userId, league: { competitionId: fixture.competitionId } },
  })
  if (!membership) return { error: "Fixture not found." }

  if (new Date(fixture.kickoffTime) <= new Date()) {
    return { error: "Deadline has passed — this fixture is locked." }
  }

  if (!Number.isInteger(home) || !Number.isInteger(away) || home < 0 || away < 0) {
    return { error: "Please enter valid scores (0 or above)." }
  }

  await savePrediction(userId, fixture.id, home, away, "WEB")
  revalidatePath("/")
  revalidatePath("/predictions")
  revalidatePath("/admin/picks")
  return { success: true }
}

/** FormData-based save — kept for any remaining form posts. */
export async function upsertPrediction(
  fixtureId: string,
  _prev: PredictionState,
  formData: FormData,
): Promise<PredictionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not signed in." }

  const home = parseInt(String(formData.get("home") ?? ""), 10)
  const away = parseInt(String(formData.get("away") ?? ""), 10)
  if (isNaN(home) || isNaN(away)) {
    return { error: "Please enter valid scores (0 or above)." }
  }
  return saveScoresForUser(session.user.id, fixtureId, home, away)
}

/** Direct save used by auto-save on the predictions page. */
export async function savePredictionScores(
  fixtureId: string,
  home: number,
  away: number,
): Promise<PredictionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not signed in." }
  return saveScoresForUser(session.user.id, fixtureId, home, away)
}

/**
 * Make this fixture the user's banker for its gameweek, or clear it. The
 * one-per-round rule and the kickoff locks live in `setBanker()`.
 */
export async function toggleBanker(fixtureId: string, on: boolean): Promise<BankerState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not signed in." }
  const userId = session.user.id

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  if (!fixture) return { error: "Fixture not found." }

  const membership = await prisma.leagueMembership.findFirst({
    where: { userId, league: { competitionId: fixture.competitionId } },
  })
  if (!membership) return { error: "Fixture not found." }

  const result = await setBanker(userId, fixtureId, on)
  if (!result.ok) return { error: result.error }

  revalidatePath("/")
  return {}
}
