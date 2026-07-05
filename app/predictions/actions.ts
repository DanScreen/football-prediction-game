"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { upsertPredictionWithSync } from "@/lib/predictions"

export type PredictionState = { error?: string; success?: boolean }

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

  if (new Date(fixture.kickoffTime) <= new Date()) {
    return { error: "Deadline has passed — this fixture is locked." }
  }

  const home = parseInt(String(formData.get("home") ?? ""), 10)
  const away = parseInt(String(formData.get("away") ?? ""), 10)

  if (isNaN(home) || isNaN(away) || home < 0 || away < 0) {
    return { error: "Please enter valid scores (0 or above)." }
  }

  // Upsert prediction and sync to identical fixtures in the user's other leagues
  await upsertPredictionWithSync(userId, fixture, home, away, "WEB")

  revalidatePath("/")
  revalidatePath("/predictions")
  return { success: true }
}
