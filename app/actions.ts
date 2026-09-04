"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { RESULT_DELAY_MS, confirmResultsFromApi } from "@/lib/resolution"
import { FixtureStatus } from "@/app/generated/prisma/client"

export type RequestResultState = { error?: string; found?: boolean; pending?: boolean }

/**
 * Any league member can nudge the result lookup if the cron sweep hasn't confirmed
 * this fixture yet. Transitions the fixture once due and runs the API confirm pass.
 */
export async function requestResult(fixtureId: string): Promise<RequestResultState> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Not signed in." }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  if (!fixture) return { error: "Fixture not found." }

  const membership = await prisma.leagueMembership.findFirst({
    where: { userId: session.user.id, league: { competitionId: fixture.competitionId } },
  })
  if (!membership) return { error: "Fixture not found." }

  if (fixture.status === FixtureStatus.COMPLETED) return { found: true }

  const dueAt = new Date(fixture.kickoffTime.getTime() + RESULT_DELAY_MS)
  if (dueAt > new Date()) {
    return { error: "Results can be requested from 1h 45m after kickoff." }
  }

  if (fixture.status === FixtureStatus.SCHEDULED) {
    await prisma.fixture.updateMany({
      where: { id: fixtureId, status: FixtureStatus.SCHEDULED },
      data: { status: FixtureStatus.AWAITING_RESULT },
    })
  }

  const { errors } = await confirmResultsFromApi()
  if (errors.length > 0) return { error: errors[0] }

  const updated = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  revalidatePath("/")
  revalidatePath("/results")
  revalidatePath("/leaderboard")

  if (updated?.status === FixtureStatus.COMPLETED) return { found: true }
  return { pending: true }
}
