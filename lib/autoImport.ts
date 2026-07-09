import { prisma } from "@/lib/prisma"
import { fetchUpcomingFixtures } from "@/lib/footballData"

/** How many upcoming rounds the sweep keeps topped up per competition. */
export const AUTO_IMPORT_ROUNDS = 2

/**
 * Import upcoming fixtures for every active, code-mapped competition that has
 * at least one subscribing league. Dedupe relies on the canonical unique key
 * (competitionId, homeTeam, awayTeam, kickoffTime) via skipDuplicates — team
 * names are stable because they always come from the same API field mapping.
 */
export async function autoImportFixtures(): Promise<{ imported: number; errors: string[] }> {
  if (!process.env.FOOTBALL_DATA_API_KEY) return { imported: 0, errors: [] }

  const competitions = await prisma.competition.findMany({
    where: { isActive: true, code: { not: null }, leagues: { some: {} } },
    select: { id: true, name: true, code: true },
  })

  let imported = 0
  const errors: string[] = []

  for (const comp of competitions) {
    let fixtures
    try {
      fixtures = await fetchUpcomingFixtures(comp.code!, AUTO_IMPORT_ROUNDS)
    } catch (err) {
      errors.push(err instanceof Error ? err.message : `Import failed for ${comp.name}.`)
      continue
    }
    if (fixtures.length === 0) continue

    const { count } = await prisma.fixture.createMany({
      data: fixtures.map((f) => ({
        competitionId: comp.id,
        round: f.round ?? "Unknown round",
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoffTime: new Date(f.kickoffTime),
      })),
      skipDuplicates: true,
    })
    imported += count
  }

  return { imported, errors }
}
