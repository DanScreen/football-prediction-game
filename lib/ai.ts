import Anthropic from "@anthropic-ai/sdk"

const MODEL = "claude-opus-4-8"
// Server-side web search tool — searched and confirmed via claude-api skill
const WEB_SEARCH = { type: "web_search_20260209", name: "web_search" }

export interface ResultLookup {
  homeScore: number
  awayScore: number
  rawText: string
}

export interface ProposedFixture {
  homeTeam: string
  awayTeam: string
  kickoffTime: string
}

function extractJson<T>(text: string, pattern: RegExp): T {
  const match = text.match(pattern)
  if (!match) throw new Error(`Could not parse AI response: ${text.slice(0, 200)}`)
  return JSON.parse(match[0]) as T
}

export async function lookupResult(
  homeTeam: string,
  awayTeam: string,
  competition: string,
  round: string,
  kickoffTime: Date,
): Promise<ResultLookup> {
  const client = new Anthropic()

  const dateStr = kickoffTime.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 512,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [WEB_SEARCH] as any,
    messages: [
      {
        role: "user",
        content: `What was the final score of ${homeTeam} vs ${awayTeam} in ${competition} (${round}) on ${dateStr}?

Search for the result and respond with ONLY a JSON object — no markdown, no explanation:
{"home": <integer>, "away": <integer>}

"home" = ${homeTeam} goals, "away" = ${awayTeam} goals.`,
      },
    ],
  })

  const msg = await stream.finalMessage()

  const textBlock = msg.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no text")

  const raw = textBlock.text.trim()
  const parsed = extractJson<{ home: unknown; away: unknown }>(raw, /\{[^}]+\}/)

  if (typeof parsed.home !== "number" || typeof parsed.away !== "number") {
    throw new Error(`Invalid score in AI response: ${raw}`)
  }

  return { homeScore: parsed.home, awayScore: parsed.away, rawText: raw }
}

export async function lookupFixtures(
  competition: string,
  round: string,
  season: string,
): Promise<ProposedFixture[]> {
  const client = new Anthropic()

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [WEB_SEARCH] as any,
    messages: [
      {
        role: "user",
        content: `Find all fixtures for ${competition}, ${round}, ${season} season.

Return ONLY a JSON array — no markdown, no explanation:
[{"homeTeam": "Team A", "awayTeam": "Team B", "kickoffTime": "2025-03-08T15:00:00Z"}]

Use ISO 8601 UTC for kickoffTime. Include every match in this round.`,
      },
    ],
  })

  const msg = await stream.finalMessage()

  const textBlock = msg.content.find((b) => b.type === "text")
  if (!textBlock || textBlock.type !== "text") throw new Error("AI returned no text")

  const raw = textBlock.text.trim()
  const parsed = extractJson<unknown[]>(raw, /\[[\s\S]*\]/)

  if (!Array.isArray(parsed)) throw new Error("AI did not return an array")

  return parsed.filter(
    (f): f is ProposedFixture =>
      typeof f === "object" &&
      f !== null &&
      typeof (f as ProposedFixture).homeTeam === "string" &&
      typeof (f as ProposedFixture).awayTeam === "string" &&
      typeof (f as ProposedFixture).kickoffTime === "string",
  )
}
