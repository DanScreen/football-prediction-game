"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { fetchUpcomingFixtures } from "@/lib/footballData"
import type { ProposedFixture } from "@/lib/ai"
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

export type FetchProposalState = {
  error?: string
  proposed?: { competition: string; fixtures: ProposedFixture[] }
}

export async function fetchImportProposal(
  _prev: FetchProposalState,
  formData: FormData,
): Promise<FetchProposalState> {
  const { leagueId } = await requireCommissioner()

  const rounds = Math.min(3, Math.max(1, parseInt(String(formData.get("rounds") ?? "1"), 10) || 1))

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return { error: "League not found." }

  try {
    const fixtures = await fetchUpcomingFixtures(league.competition, rounds)
    if (fixtures.length === 0) {
      return { error: "No upcoming fixtures found. The competition may be in an off-season period." }
    }
    return { proposed: { competition: league.competition, fixtures } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch fixtures." }
  }
}

export type ConfirmImportState = { error?: string }

export async function confirmImport(
  _prev: ConfirmImportState,
  formData: FormData,
): Promise<ConfirmImportState> {
  const { leagueId } = await requireCommissioner()

  const rawFixtures = String(formData.get("fixtures") ?? "")
  if (!rawFixtures) return { error: "Missing fixture data." }

  let fixtures: ProposedFixture[]
  try {
    fixtures = JSON.parse(rawFixtures) as ProposedFixture[]
  } catch {
    return { error: "Invalid fixture data." }
  }

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return { error: "No fixtures selected." }
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return { error: "League not found." }

  for (const f of fixtures) {
    const kickoffTime = new Date(f.kickoffTime)
    if (isNaN(kickoffTime.getTime())) {
      return { error: `Invalid kickoff time for ${f.homeTeam} vs ${f.awayTeam}.` }
    }
    await prisma.fixture.create({
      data: {
        leagueId,
        competition: league.competition,
        round: f.round ?? "Round 1",
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoffTime,
      },
    })
  }

  revalidatePath("/admin/fixtures")
  revalidatePath("/")
  redirect("/admin/fixtures")
}
