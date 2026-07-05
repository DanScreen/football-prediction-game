const BASE_URL = "https://api.football-data.org/v4"

const COMPETITION_CODES: Record<string, string> = {
  "Premier League": "PL",
  "FIFA World Cup 2026": "WC",
}

export interface ProposedFixture {
  homeTeam: string
  awayTeam: string
  kickoffTime: string
  round?: string
}

interface FDTeam {
  id: number
  name: string
  shortName: string
  tla: string
}

interface FDScore {
  fullTime: { home: number | null; away: number | null }
}

interface FDMatch {
  id: number
  utcDate: string
  status: string
  matchday: number | null
  stage: string
  group: string | null
  homeTeam: FDTeam
  awayTeam: FDTeam
  score?: FDScore
}

const STAGE_LABELS: Record<string, string> = {
  LAST_16: "Round of 16",
  QUARTER_FINALS: "Quarter-Finals",
  SEMI_FINALS: "Semi-Finals",
  THIRD_PLACE: "Third Place Play-off",
  FINAL: "Final",
}

function formatRound(match: FDMatch): string {
  if (match.stage === "GROUP_STAGE") {
    const group = match.group ? match.group.replace(/^GROUP_/, "Group ") : ""
    return group ? `Group Stage - ${group}` : "Group Stage"
  }
  if (STAGE_LABELS[match.stage]) return STAGE_LABELS[match.stage]
  if (match.matchday != null) return `Matchweek ${match.matchday}`
  return match.stage
}

function roundKey(match: FDMatch): string {
  if (match.stage === "REGULAR_SEASON" || match.stage === "SEASON_STAGE") {
    return `mw:${match.matchday}`
  }
  if (match.stage === "GROUP_STAGE") {
    return `group:${match.group ?? ""}:${match.matchday}`
  }
  return `stage:${match.stage}`
}

async function fdFetch(path: string): Promise<Response> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not configured.")
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`football-data.org API error ${res.status}: ${body.slice(0, 200)}`)
  }
  return res
}

export async function fetchUpcomingFixtures(
  competition: string,
  rounds: number,
): Promise<ProposedFixture[]> {
  const code = COMPETITION_CODES[competition]
  if (!code) {
    throw new Error(
      `No API mapping for "${competition}". Supported: ${Object.keys(COMPETITION_CODES).join(", ")}.`,
    )
  }

  const res = await fdFetch(`/competitions/${code}/matches?status=SCHEDULED`)
  const data = (await res.json()) as { matches: FDMatch[] }
  const matches = data.matches ?? []

  const seenKeys: string[] = []
  for (const m of matches) {
    const key = roundKey(m)
    if (!seenKeys.includes(key)) seenKeys.push(key)
    if (seenKeys.length === rounds) break
  }
  const allowedKeys = new Set(seenKeys)

  return matches
    .filter((m) => allowedKeys.has(roundKey(m)))
    .map((m) => ({
      homeTeam: m.homeTeam.shortName || m.homeTeam.name,
      awayTeam: m.awayTeam.shortName || m.awayTeam.name,
      kickoffTime: m.utcDate,
      round: formatRound(m),
    }))
}

function teamNameMatches(team: FDTeam, query: string): boolean {
  const q = query.toLowerCase()
  const candidates = [team.name, team.shortName, team.tla]
    .filter(Boolean)
    .map((s) => s.toLowerCase())
  return candidates.some((c) => c.includes(q) || q.includes(c))
}

/** API code for a competition name, or null if not supported by the free tier. */
export function competitionCode(competition: string): string | null {
  return COMPETITION_CODES[competition] ?? null
}

/** All finished matches for a competition between two dates (single API call). */
export async function fetchFinishedMatches(
  code: string,
  dateFrom: string,
  dateTo: string,
): Promise<FDMatch[]> {
  const res = await fdFetch(
    `/competitions/${code}/matches?status=FINISHED&dateFrom=${dateFrom}&dateTo=${dateTo}`,
  )
  const data = (await res.json()) as { matches: FDMatch[] }
  return data.matches ?? []
}

/** Fuzzy-match a fixture's team names against fetched matches; null if not found. */
export function findMatchScore(
  matches: FDMatch[],
  homeTeam: string,
  awayTeam: string,
): { homeScore: number; awayScore: number } | null {
  const match = matches.find(
    (m) =>
      teamNameMatches(m.homeTeam, homeTeam) &&
      teamNameMatches(m.awayTeam, awayTeam) &&
      m.score?.fullTime?.home != null,
  )
  if (!match) return null
  return {
    homeScore: match.score!.fullTime!.home!,
    awayScore: match.score!.fullTime!.away!,
  }
}

export function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

export async function lookupResult(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  _round: string,
  kickoffTime: Date,
): Promise<{ homeScore: number; awayScore: number }> {
  const code = COMPETITION_CODES[competition]
  if (!code) throw new Error(`No API mapping for "${competition}".`)

  const dateFrom = isoDate(kickoffTime)
  const dateTo = isoDate(new Date(kickoffTime.getTime() + 2 * 24 * 60 * 60 * 1000))

  const matches = await fetchFinishedMatches(code, dateFrom, dateTo)
  const score = findMatchScore(matches, homeTeam, awayTeam)

  if (!score) {
    throw new Error(
      `No finished result found for ${homeTeam} vs ${awayTeam} around ${dateFrom}. The match may not have been played yet.`,
    )
  }
  return score
}
