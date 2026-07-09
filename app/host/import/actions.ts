"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { fetchUpcomingFixtures, type ProposedFixture } from "@/lib/footballData"
import { requireSiteAdmin } from "@/lib/adminAuth"

export type FetchProposalState = {
  error?: string
  proposed?: { competitionId: string; competition: string; fixtures: ProposedFixture[] }
}

export async function fetchImportProposal(
  _prev: FetchProposalState,
  formData: FormData,
): Promise<FetchProposalState> {
  await requireSiteAdmin()

  const competitionId = String(formData.get("competitionId") ?? "")
  const rounds = Math.min(3, Math.max(1, parseInt(String(formData.get("rounds") ?? "1"), 10) || 1))

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } })
  if (!competition) return { error: "Competition not found." }
  if (!competition.code) {
    return { error: `${competition.name} has no football-data.org code — add fixtures manually.` }
  }

  try {
    const fixtures = await fetchUpcomingFixtures(competition.code, rounds)
    if (fixtures.length === 0) {
      return { error: "No upcoming fixtures found. The competition may be in an off-season period." }
    }
    return { proposed: { competitionId, competition: competition.name, fixtures } }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to fetch fixtures." }
  }
}

export type ConfirmImportState = { error?: string }

export async function confirmImport(
  _prev: ConfirmImportState,
  formData: FormData,
): Promise<ConfirmImportState> {
  await requireSiteAdmin()

  const competitionId = String(formData.get("competitionId") ?? "")
  const rawFixtures = String(formData.get("fixtures") ?? "")
  if (!competitionId || !rawFixtures) return { error: "Missing fixture data." }

  let fixtures: ProposedFixture[]
  try {
    fixtures = JSON.parse(rawFixtures) as ProposedFixture[]
  } catch {
    return { error: "Invalid fixture data." }
  }

  if (!Array.isArray(fixtures) || fixtures.length === 0) {
    return { error: "No fixtures selected." }
  }

  const data = []
  for (const f of fixtures) {
    const kickoffTime = new Date(f.kickoffTime)
    if (isNaN(kickoffTime.getTime())) {
      return { error: `Invalid kickoff time for ${f.homeTeam} vs ${f.awayTeam}.` }
    }
    data.push({
      competitionId,
      round: f.round ?? "Round 1",
      homeTeam: f.homeTeam,
      awayTeam: f.awayTeam,
      kickoffTime,
    })
  }

  // Canonical unique key (competitionId, teams, kickoff) makes re-imports safe
  await prisma.fixture.createMany({ data, skipDuplicates: true })

  revalidatePath("/host/fixtures")
  revalidatePath("/")
  redirect("/host/fixtures")
}
