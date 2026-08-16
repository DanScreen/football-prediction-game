import { prisma } from "@/lib/prisma"
import { computeLeaderboard, type PointsBreakdown } from "@/lib/leaderboard"
import { AnimatedPoints } from "./AnimatedPoints"

type FormTier = "strong" | "mixed" | "poor" | "none"

/**
 * Form cells are dual-encoded: a glyph as well as a colour. Colour alone left
 * colour-blind players unable to read their own form, and the `title` tooltip
 * that carried the meaning does nothing on touch.
 */
const FORM_TIERS: Record<FormTier, { class: string; glyph: string; label: string }> = {
  strong: { class: "bg-good-tint text-good border-good-line", glyph: "▲", label: "Strong" },
  mixed: { class: "bg-clock-tint text-clock border-clock-line", glyph: "■", label: "Mixed" },
  poor: { class: "bg-bad-tint text-bad border-bad-line", glyph: "▼", label: "Poor" },
  none: { class: "bg-chip text-ink-faint border-line", glyph: "·", label: "No picks" },
}

export const FORM_LEGEND = FORM_TIERS

/**
 * Where a player's points came from. These five sum to their total, so the row
 * accounts for itself — useful when someone asks why they're behind.
 *
 * Banker is the *extra* the doubling produced, not the whole bankered fixture:
 * a bankered exact score reads as 3 exact + 3 banker, which keeps the "exact"
 * column meaning "points from exact scores" rather than silently including a
 * multiplier.
 */
const BREAKDOWN_COLUMNS: {
  key: keyof PointsBreakdown
  label: string
  /** Set where `label` is an emoji, which a screen reader can't announce usefully. */
  srLabel?: string
  short: string
  title: string
  tone: string
}[] = [
  {
    key: "result",
    label: "Result",
    short: "result",
    title: "Points from getting the result right only (1 each)",
    tone: "text-ink-muted",
  },
  {
    key: "close",
    label: "Close",
    short: "close",
    title: "Points from the right result with a scoreline within one goal, but not exact (1.5 each)",
    tone: "text-info",
  },
  {
    key: "exact",
    label: "Exact",
    short: "exact",
    title: "Points from exact scorelines (3 each)",
    tone: "text-good",
  },
  {
    key: "banker",
    label: "★",
    srLabel: "Banker",
    short: "banker",
    title: "Extra points earned by doubling a banker pick",
    tone: "text-clock",
  },
  {
    key: "streak",
    label: "🔥",
    srLabel: "Streak",
    short: "streak",
    title: "Streak bonus points for calling a lot of a gameweek's results right",
    tone: "text-clock",
  },
]

type Props = {
  leagueId: string
  leagueName: string
  competitionName: string
  currentUserId: string
  /** Rendered as a section heading only when the user is in more than one league. */
  showHeading: boolean
}

/**
 * One league's standings table. Rendered once per league the user belongs to —
 * standings are the one surface that is genuinely per-league, since predictions
 * themselves are shared across every league on the same competition.
 */
export default async function LeagueBoard({
  leagueId,
  leagueName,
  competitionName,
  currentUserId,
  showHeading,
}: Props) {
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    select: { competitionId: true },
  })
  if (!league) return null

  const memberIds = (
    await prisma.leagueMembership.findMany({
      where: { leagueId },
      select: { userId: true },
    })
  ).map((m) => m.userId)

  const [ranked, scoredPredictions, completedFixtures] = await Promise.all([
    computeLeaderboard(leagueId),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        fixture: { competitionId: league.competitionId },
        pointsAwarded: { not: null },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        fixture: { select: { round: true } },
      },
    }),
    prisma.fixture.findMany({
      where: { competitionId: league.competitionId, status: "COMPLETED" },
      select: { round: true, kickoffTime: true },
    }),
  ])

  // Build last 5 completed rounds (oldest → newest for form strip)
  const roundMaxKickoff = new Map<string, Date>()
  for (const f of completedFixtures) {
    const existing = roundMaxKickoff.get(f.round)
    if (!existing || f.kickoffTime > existing) roundMaxKickoff.set(f.round, f.kickoffTime)
  }

  const last5Rounds = [...roundMaxKickoff.entries()]
    .sort(([, a], [, b]) => b.getTime() - a.getTime())
    .slice(0, 5)
    .reverse()
    .map(([round]) => round)

  // Per-user, per-round scored totals for the form strip
  const roundStatsByUser = new Map<string, Map<string, { scored: number; count: number }>>()
  for (const p of scoredPredictions) {
    let byRound = roundStatsByUser.get(p.userId)
    if (!byRound) {
      byRound = new Map()
      roundStatsByUser.set(p.userId, byRound)
    }
    const s = byRound.get(p.fixture.round) ?? { scored: 0, count: 0 }
    byRound.set(p.fixture.round, {
      scored: s.scored + (p.pointsAwarded ?? 0),
      count: s.count + 1,
    })
  }

  const formForUser = (userId: string): { round: string; tier: FormTier; scored: number }[] => {
    const byRound = roundStatsByUser.get(userId)
    return last5Rounds.map((round) => {
      const s = byRound?.get(round)
      if (!s || s.count === 0) return { round, tier: "none", scored: 0 }
      const pct = s.scored / (s.count * 3)
      const tier: FormTier = pct > 0.4 ? "strong" : pct > 0.2 ? "mixed" : "poor"
      return { round, tier, scored: s.scored }
    })
  }

  const rankDisplay = (i: number) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ranked[i].rank

  // Podium rows fade from a gold-ish tint down to the plain surface. Tinting by
  // opacity of one token keeps the ramp readable in both themes — stock oranges
  // and ambers turned to mud on the dark ground.
  const rowBg = (i: number) =>
    i === 0
      ? "bg-clock-tint hover:bg-clock-tint/70"
      : i === 1
        ? "bg-chip/60 hover:bg-chip"
        : i === 2
          ? "bg-clock-tint/40 hover:bg-clock-tint/60"
          : "hover:bg-ground"

  return (
    <section id={`league-${leagueId}`} className="scroll-mt-4">
      {showHeading && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 px-1">
          <h2 className="text-lg font-bold text-ink">{leagueName}</h2>
          <p className="text-xs text-ink-muted">
            {competitionName} · {ranked.length} player{ranked.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {ranked.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface py-10 text-center text-ink-muted shadow-card">
          <p className="mb-2 text-3xl">🏆</p>
          <p className="font-medium">No players yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line shadow-card bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">
              {leagueName} standings, ranked by confirmed points
            </caption>
            <thead className="bg-board text-board-fore text-xs uppercase tracking-wider">
              <tr>
                <th scope="col" className="text-left px-4 py-3 w-10 font-semibold text-board-muted">
                  #
                </th>
                <th scope="col" className="text-left px-4 py-3 font-semibold text-board-muted">
                  Player
                </th>
                <th scope="col" className="text-right px-4 py-3 font-semibold text-board-gold">
                  Points
                </th>
                {BREAKDOWN_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    title={col.title}
                    className="text-right px-3 py-3 hidden md:table-cell font-semibold text-board-muted whitespace-nowrap"
                  >
                    {col.srLabel ? (
                      <>
                        <span aria-hidden="true">{col.label}</span>
                        <span className="sr-only">{col.srLabel}</span>
                      </>
                    ) : (
                      col.label
                    )}
                  </th>
                ))}
                {last5Rounds.length > 0 && (
                  <th
                    scope="col"
                    className="text-right px-2 sm:px-4 py-3 font-semibold text-board-muted"
                  >
                    Form{" "}
                    <span className="hidden md:inline normal-case font-normal opacity-70">
                      (oldest → newest)
                    </span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {ranked.map((entry, i) => {
                const form = formForUser(entry.id)
                return (
                  <tr
                    key={entry.id}
                    className={`transition-colors animate-slide-up ${rowBg(i)}`}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <td className="px-4 py-3 font-bold text-ink-muted tabular-nums text-base">
                      {rankDisplay(i)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-ink">{entry.displayName}</span>
                      {entry.isBot && (
                        <span className="ml-1.5 text-xs text-ink-faint font-normal">🤖</span>
                      )}
                      {entry.id === currentUserId && (
                        <span className="ml-1.5 text-xs text-pitch font-medium">(you)</span>
                      )}
                      {/* The breakdown columns are desktop-only — five more numeric
                          columns would force the table to scroll sideways on a phone.
                          Below md it becomes a wrapping chip line, and only the
                          non-zero parts show, so it stays short. */}
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] md:hidden">
                        {BREAKDOWN_COLUMNS.filter((col) => entry.breakdown[col.key] > 0).map(
                          (col) => (
                            <span key={col.key} className={col.tone}>
                              <span className="font-semibold tabular-nums">
                                {entry.breakdown[col.key]}
                              </span>{" "}
                              {col.short}
                            </span>
                          ),
                        )}
                      </span>
                    </td>
                    <td className="score-digits px-4 py-3 text-right text-ink text-base">
                      <AnimatedPoints value={entry.confirmedPoints} />
                      {entry.provisionalPoints > 0 && (
                        <span
                          className="ml-1.5 text-xs font-semibold text-clock"
                          title="Provisional points from unconfirmed results"
                        >
                          +{entry.provisionalPoints}
                        </span>
                      )}
                    </td>
                    {BREAKDOWN_COLUMNS.map((col) => {
                      const value = entry.breakdown[col.key]
                      return (
                        <td
                          key={col.key}
                          title={col.key === "exact" ? `${entry.exactCount} exact score${entry.exactCount !== 1 ? "s" : ""}` : undefined}
                          className={`px-3 py-3 text-right hidden md:table-cell tabular-nums ${
                            value > 0 ? col.tone : "text-ink-faint"
                          }`}
                        >
                          {value > 0 ? value : "–"}
                        </td>
                      )
                    })}
                    {last5Rounds.length > 0 && (
                      <td className="px-2 sm:px-4 py-3">
                        <div className="flex justify-end gap-1">
                          {form.map(({ round, tier, scored }) => {
                            const t = FORM_TIERS[tier]
                            return (
                              <span
                                key={round}
                                title={
                                  tier === "none"
                                    ? `${round}: no predictions`
                                    : `${round}: ${scored} pts (${t.label.toLowerCase()})`
                                }
                                aria-label={
                                  tier === "none"
                                    ? `${round}: no predictions`
                                    : `${round}: ${scored} points, ${t.label.toLowerCase()}`
                                }
                                className={`flex h-5 w-5 items-center justify-center rounded-sm border text-[9px] leading-none ${t.class}`}
                              >
                                <span aria-hidden="true">{t.glyph}</span>
                              </span>
                            )
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
