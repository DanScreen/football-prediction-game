import { prisma } from "@/lib/prisma"
import { FixtureStatus } from "@/app/generated/prisma/client"
import { competitionCode, fetchFinishedMatches, findMatchScore, isoDate } from "@/lib/footballData"

/** Fixtures become eligible for a result this long after kickoff. */
export const RESULT_DELAY_MS = 2.5 * 60 * 60 * 1000

/**
 * Move SCHEDULED fixtures ≥2.5h past kickoff to AWAITING_RESULT.
 * Scoped to one league when leagueId is given, otherwise all leagues.
 */
export async function transitionDueFixtures(leagueId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - RESULT_DELAY_MS)
  const { count } = await prisma.fixture.updateMany({
    where: {
      ...(leagueId ? { leagueId } : {}),
      status: FixtureStatus.SCHEDULED,
      kickoffTime: { lte: cutoff },
    },
    data: { status: FixtureStatus.AWAITING_RESULT },
  })
  return count
}

/**
 * Fetch proposed scores for AWAITING_RESULT fixtures that don't have one yet —
 * one football-data.org call per competition, fuzzy-matched to every awaiting
 * fixture (cross-league copies of the same match share the one lookup).
 * Proposals wait for Commissioner confirmation; nothing is scored here.
 */
export async function fetchProposals(): Promise<{ proposed: number; errors: string[] }> {
  if (!process.env.FOOTBALL_DATA_API_KEY) return { proposed: 0, errors: [] }

  const fixtures = await prisma.fixture.findMany({
    where: { status: FixtureStatus.AWAITING_RESULT, proposedHomeScore: null },
  })
  if (fixtures.length === 0) return { proposed: 0, errors: [] }

  const byCompetition = new Map<string, typeof fixtures>()
  for (const f of fixtures) {
    const arr = byCompetition.get(f.competition) ?? []
    arr.push(f)
    byCompetition.set(f.competition, arr)
  }

  let proposed = 0
  const errors: string[] = []

  for (const [competition, comps] of byCompetition) {
    const code = competitionCode(competition)
    if (!code) continue

    const kickoffs = comps.map((f) => f.kickoffTime.getTime())
    const dateFrom = isoDate(new Date(Math.min(...kickoffs)))
    const dateTo = isoDate(new Date(Math.max(...kickoffs) + 2 * 24 * 60 * 60 * 1000))

    let matches
    try {
      matches = await fetchFinishedMatches(code, dateFrom, dateTo)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Lookup failed for ${competition}.`)
      continue
    }

    for (const f of comps) {
      const score = findMatchScore(matches, f.homeTeam, f.awayTeam)
      if (!score) continue
      const { count } = await prisma.fixture.updateMany({
        where: { id: f.id, status: FixtureStatus.AWAITING_RESULT },
        data: { proposedHomeScore: score.homeScore, proposedAwayScore: score.awayScore },
      })
      proposed += count
    }
  }

  return { proposed, errors }
}

export async function runResolutionSweep() {
  const transitioned = await transitionDueFixtures()
  const { proposed, errors } = await fetchProposals()
  return { transitioned, proposed, errors }
}
