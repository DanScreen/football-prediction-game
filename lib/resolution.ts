import { prisma } from "@/lib/prisma"
import { FixtureStatus, ResultSource } from "@/app/generated/prisma/client"
import { fetchFinishedMatches, findMatchScore, isoDate } from "@/lib/footballData"
import { autoImportFixtures } from "@/lib/autoImport"
import { confirmFixtureResult } from "@/lib/results"

/** Fixtures become eligible for a result this long after kickoff (1h45m ≈ full time + stoppage). */
export const RESULT_DELAY_MS = 1.75 * 60 * 60 * 1000

/**
 * How long after kickoff we keep re-checking AI-confirmed scores against the API.
 * football-data.org can publish FINISHED with a score that later changes (e.g. a
 * post-whistle VAR / disallowed goal). Without this window, the first published
 * score sticks forever because COMPLETED fixtures were never looked up again.
 * Host MANUAL corrections are never overwritten.
 */
export const RESULT_RECONCILE_WINDOW_MS = 24 * 60 * 60 * 1000

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
 * as soon as a score is found. Also re-checks recent AI_CONFIRMED results so a
 * score that later changes (disallowed goal, corrected FINISHED publish) is
 * applied automatically. Failures are isolated per fixture.
 */
export async function confirmResultsFromApi(): Promise<{
  confirmed: number
  corrected: number
  errors: string[]
}> {
  if (!process.env.FOOTBALL_DATA_API_KEY) {
    return { confirmed: 0, corrected: 0, errors: [] }
  }

  let confirmed = await confirmLegacyProposals()
  let corrected = 0

  const reconcileAfter = new Date(Date.now() - RESULT_RECONCILE_WINDOW_MS)
  const fixtures = await prisma.fixture.findMany({
    where: {
      OR: [
        { status: FixtureStatus.AWAITING_RESULT },
        {
          status: FixtureStatus.COMPLETED,
          resultSource: ResultSource.AI_CONFIRMED,
          kickoffTime: { gte: reconcileAfter },
        },
      ],
    },
    include: { competition: { select: { id: true, name: true, code: true } } },
  })

  if (fixtures.length === 0) return { confirmed, corrected, errors: [] }

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

      if (f.status === FixtureStatus.COMPLETED) {
        if (
          f.actualHomeScore === score.homeScore &&
          f.actualAwayScore === score.awayScore
        ) {
          continue
        }
        try {
          await confirmFixtureResult(
            f.id,
            score.homeScore,
            score.awayScore,
            ResultSource.AI_CONFIRMED,
          )
          corrected++
        } catch {
          /* isolated — host can enter manually */
        }
        continue
      }

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

  return { confirmed, corrected, errors }
}

/** @deprecated Use confirmResultsFromApi — kept for callers mid-migration. */
export const fetchProposals = confirmResultsFromApi

export async function runResolutionSweep() {
  const imported = await autoImportFixtures()
  const transitioned = await transitionDueFixtures()
  const { confirmed, corrected, errors } = await confirmResultsFromApi()
  return {
    transitioned,
    confirmed,
    corrected,
    imported: imported.imported,
    errors: [...imported.errors, ...errors],
  }
}
