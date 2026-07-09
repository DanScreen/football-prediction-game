import { prisma } from "@/lib/prisma"
import { FixtureStatus } from "@/app/generated/prisma/client"
import { fetchFinishedMatches, findMatchScore, isoDate } from "@/lib/footballData"
import { autoImportFixtures } from "@/lib/autoImport"

/** Fixtures become eligible for a result this long after kickoff (1h45m ≈ full time + stoppage). */
export const RESULT_DELAY_MS = 1.75 * 60 * 60 * 1000

/** Move SCHEDULED fixtures ≥1h45m past kickoff to AWAITING_RESULT (platform-wide). */
export async function transitionDueFixtures(): Promise<number> {
  const cutoff = new Date(Date.now() - RESULT_DELAY_MS)
  const { count } = await prisma.fixture.updateMany({
    where: {
      status: FixtureStatus.SCHEDULED,
      kickoffTime: { lte: cutoff },
    },
    data: { status: FixtureStatus.AWAITING_RESULT },
  })
  return count
}

/**
 * Fetch proposed scores for AWAITING_RESULT fixtures that don't have one yet —
 * one football-data.org call per competition. Proposed scores surface to users
 * as provisional results/points until a site host confirms; nothing is scored here.
 */
export async function fetchProposals(): Promise<{ proposed: number; errors: string[] }> {
  if (!process.env.FOOTBALL_DATA_API_KEY) return { proposed: 0, errors: [] }

  const fixtures = await prisma.fixture.findMany({
    where: { status: FixtureStatus.AWAITING_RESULT, proposedHomeScore: null },
    include: { competition: { select: { id: true, name: true, code: true } } },
  })
  if (fixtures.length === 0) return { proposed: 0, errors: [] }

  const byCompetition = new Map<string, typeof fixtures>()
  for (const f of fixtures) {
    const arr = byCompetition.get(f.competitionId) ?? []
    arr.push(f)
    byCompetition.set(f.competitionId, arr)
  }

  let proposed = 0
  const errors: string[] = []

  for (const [, comps] of byCompetition) {
    const { name, code } = comps[0].competition
    if (!code) continue

    const kickoffs = comps.map((f) => f.kickoffTime.getTime())
    const dateFrom = isoDate(new Date(Math.min(...kickoffs)))
    const dateTo = isoDate(new Date(Math.max(...kickoffs) + 2 * 24 * 60 * 60 * 1000))

    let matches
    try {
      matches = await fetchFinishedMatches(code, dateFrom, dateTo)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Lookup failed for ${name}.`)
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
  const imported = await autoImportFixtures()
  const transitioned = await transitionDueFixtures()
  const { proposed, errors } = await fetchProposals()
  return {
    transitioned,
    proposed,
    imported: imported.imported,
    errors: [...imported.errors, ...errors],
  }
}
