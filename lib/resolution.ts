import { prisma } from "@/lib/prisma"
import { FixtureStatus, ResultSource } from "@/app/generated/prisma/client"
import { fetchFinishedMatches, findMatchScore, isoDate } from "@/lib/footballData"
import { autoImportFixtures } from "@/lib/autoImport"
import { confirmFixtureResult } from "@/lib/results"

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
 * Confirm any AWAITING_RESULT fixtures that still carry legacy proposed scores from
 * the old confirm-before-save flow.
 */
async function confirmLegacyProposals(): Promise<number> {
  const fixtures = await prisma.fixture.findMany({
    where: {
      status: FixtureStatus.AWAITING_RESULT,
      proposedHomeScore: { not: null },
      proposedAwayScore: { not: null },
    },
    select: { id: true, proposedHomeScore: true, proposedAwayScore: true },
  })

  let confirmed = 0
  for (const f of fixtures) {
    try {
      await confirmFixtureResult(
        f.id,
        f.proposedHomeScore!,
        f.proposedAwayScore!,
        ResultSource.AI_CONFIRMED,
      )
      confirmed++
    } catch {
      /* isolated — manual entry remains */
    }
  }
  return confirmed
}

/**
 * Look up AWAITING_RESULT fixtures from football-data.org and confirm each match
 * as soon as a score is found. Failures are isolated per fixture.
 */
export async function confirmResultsFromApi(): Promise<{ confirmed: number; errors: string[] }> {
  if (!process.env.FOOTBALL_DATA_API_KEY) return { confirmed: 0, errors: [] }

  let confirmed = await confirmLegacyProposals()

  const fixtures = await prisma.fixture.findMany({
    where: { status: FixtureStatus.AWAITING_RESULT },
    include: { competition: { select: { id: true, name: true, code: true } } },
  })
  if (fixtures.length === 0) return { confirmed, errors: [] }

  const byCompetition = new Map<string, typeof fixtures>()
  for (const f of fixtures) {
    const arr = byCompetition.get(f.competitionId) ?? []
    arr.push(f)
    byCompetition.set(f.competitionId, arr)
  }

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
      try {
        await confirmFixtureResult(
          f.id,
          score.homeScore,
          score.awayScore,
          ResultSource.AI_CONFIRMED,
        )
        confirmed++
      } catch {
        /* isolated — host can enter manually */
      }
    }
  }

  return { confirmed, errors }
}

/** @deprecated Use confirmResultsFromApi — kept for callers mid-migration. */
export const fetchProposals = confirmResultsFromApi

export async function runResolutionSweep() {
  const imported = await autoImportFixtures()
  const transitioned = await transitionDueFixtures()
  const { confirmed, errors } = await confirmResultsFromApi()
  return {
    transitioned,
    confirmed,
    imported: imported.imported,
    errors: [...imported.errors, ...errors],
  }
}
