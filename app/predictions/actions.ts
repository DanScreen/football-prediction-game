"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { upsertPrediction as savePrediction } from "@/lib/predictions"
import { setBanker } from "@/lib/banker"

export type PredictionState = { error?: string; success?: boolean }
export type BankerState = { error?: string }

export async function upsertPrediction(
  fixtureId: string,
  _prev: PredictionState,
  formData: FormData,
): Promise<PredictionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not signed in." }
  const userId = session.user.id

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  if (!fixture) return { error: "Fixture not found." }

  // Fixtures are canonical — the user must be in a league on this competition
  const membership = await prisma.leagueMembership.findFirst({
    where: { userId, league: { competitionId: fixture.competitionId } },
  })
  if (!membership) return { error: "Fixture not found." }

  if (new Date(fixture.kickoffTime) <= new Date()) {
    return { error: "Deadline has passed — this fixture is locked." }
  }

  const home = parseInt(String(formData.get("home") ?? ""), 10)
  const away = parseInt(String(formData.get("away") ?? ""), 10)

  if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
    return { error: "Please enter valid scores (0 or above)." }
  }

  await savePrediction(userId, fixture.id, home, away, "WEB")

  revalidatePath("/")
  revalidatePath("/predictions")
  return { success: true }
}

/**
 * Make this fixture the user's banker for its gameweek, or clear it. The
 * one-per-round rule and the kickoff locks live in `setBanker()`.
 */
// Takes neither the previous state nor the form body — everything it needs is
// bound at the call site — but it's still a valid `useActionState` action.
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
