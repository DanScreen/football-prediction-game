"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export type PredictionState = { error?: string; success?: boolean }

export async function upsertPrediction(
  fixtureId: string,
  _prev: PredictionState,
  formData: FormData
): Promise<PredictionState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not signed in." }

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

  await prisma.prediction.upsert({
    where: { userId_fixtureId: { userId: session.user.id, fixtureId } },
    create: {
      userId: session.user.id,
      fixtureId,
      predictedHomeScore: home,
      predictedAwayScore: away,
      submittedVia: "WEB",
    },
    update: {
      predictedHomeScore: home,
      predictedAwayScore: away,
    },
  })

  revalidatePath("/")
  revalidatePath("/predictions")
  return { success: true }
}
