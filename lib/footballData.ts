import type { ProposedFixture } from "./ai"

const BASE_URL = "https://api.football-data.org/v4"

// Maps the competition names used in the app to football-data.org competition codes.
// Free tier covers both of these.
const COMPETITION_CODES: Record<string, string> = {
  "Premier League": "PL",
  "FIFA World Cup 2026": "WC",
}

interface FDTeam {
  id: number
  name: string
  shortName: string
  tla: string
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

// Key used to group matches into logical rounds (e.g. "Matchweek 39" or "LAST_16")
function roundKey(match: FDMatch): string {
  if (match.stage === "REGULAR_SEASON" || match.stage === "SEASON_STAGE") {
    return `mw:${match.matchday}`
  }
  if (match.stage === "GROUP_STAGE") {
    return `group:${match.group ?? ""}:${match.matchday}`
  }
  return `stage:${match.stage}`
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

  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) throw new Error("FOOTBALL_DATA_API_KEY is not configured.")

  const res = await fetch(`${BASE_URL}/competitions/${code}/matches?status=SCHEDULED`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`football-data.org API error ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = (await res.json()) as { matches: FDMatch[] }
  const matches = data.matches ?? []

  // Collect round keys in the order they appear (API returns oldest first)
  // then keep only the first N distinct rounds
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
