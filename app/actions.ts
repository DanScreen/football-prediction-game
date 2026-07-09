"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { RESULT_DELAY_MS, fetchProposals } from "@/lib/resolution"
import { FixtureStatus } from "@/app/generated/prisma/client"

export type RequestResultState = { error?: string; found?: boolean; pending?: boolean }

/**
 * Any league member can ask for a fixture's result if the cron sweep hasn't
 * fetched one yet. Transitions the fixture (once due) and runs a proposal
 * fetch — the result still needs host confirmation before scoring, but shows
 * as provisional immediately.
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

  if (fixture.proposedHomeScore === null) {
    const { errors } = await fetchProposals()
    if (errors.length > 0) return { error: errors[0] }
  }

  const updated = await prisma.fixture.findUnique({ where: { id: fixtureId } })
  revalidatePath("/")

  if (updated?.proposedHomeScore !== null && updated?.proposedHomeScore !== undefined) {
    return { found: true }
  }
  return { pending: true }
}
