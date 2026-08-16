import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { resolveActiveLeagueId } from "@/lib/activeLeague"
import { computeLeaderboard } from "@/lib/leaderboard"
import { AnimatedPoints } from "./AnimatedPoints"

export const metadata = { title: "Leaderboard" }

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

export default async function LeaderboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await resolveActiveLeagueId(session.user.id)
  if (!activeLeagueId) redirect("/leagues")

  const league = await prisma.league.findUnique({
    where: { id: activeLeagueId },
    select: { name: true, competitionId: true },
  })
  if (!league) redirect("/leagues")

  const memberIds = (
    await prisma.leagueMembership.findMany({
      where: { leagueId: activeLeagueId },
      select: { userId: true },
    })
  ).map((m) => m.userId)

  const [ranked, scoredPredictions, completedFixtures] = await Promise.all([
    computeLeaderboard(activeLeagueId),
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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">{league.name}</h1>
      <p className="text-ink-muted text-sm mb-6">
        {ranked.length} player{ranked.length !== 1 ? "s" : ""}
        {last5Rounds.length > 0 && (
          <>
            {" · "}form: last {last5Rounds.length} round{last5Rounds.length !== 1 ? "s" : ""}
          </>
        )}
      </p>

      {ranked.length === 0 ? (
        <div className="text-center py-16 text-ink-muted">
          <p className="text-4xl mb-3">🏆</p>
          <p className="font-medium">No players yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-line shadow-card mb-4 bg-surface">
            <table className="w-full text-sm">
              <thead className="bg-board text-board-fore text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-4 py-3 w-10 font-semibold text-board-muted">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-board-muted">Player</th>
                  <th className="text-right px-4 py-3 font-semibold text-board-gold">Points</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell font-semibold text-board-muted">
                    Exact ⚽
                  </th>
                  {last5Rounds.length > 0 && (
                    <th className="text-right px-2 sm:px-4 py-3 font-semibold text-board-muted">
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
                        {entry.grandSlams > 0 && (
                          <span
                            className="ml-1.5 text-xs font-medium text-clock"
                            title={`${entry.grandSlams} Grand Slam${entry.grandSlams !== 1 ? "s" : ""}`}
                          >
                            🏆{entry.grandSlams > 1 ? `×${entry.grandSlams}` : ""}
                          </span>
                        )}
                        {entry.id === session.user.id && (
                          <span className="ml-1.5 text-xs text-pitch font-medium">(you)</span>
                        )}
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
                      <td className="px-4 py-3 text-right text-ink-muted hidden sm:table-cell tabular-nums">
                        {entry.exactCount}
                      </td>
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

          {last5Rounds.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-ink-muted">
              <span className="font-semibold text-ink-mid">
                Form key <span className="font-normal">(oldest → newest)</span>:
              </span>
              {(
                [
                  ["strong", ">40% of pts"],
                  ["mixed", "21–40%"],
                  ["poor", "≤20%"],
                  ["none", "No picks"],
                ] as const
              ).map(([tier, label]) => (
                <span key={tier} className="flex items-center gap-1.5">
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 items-center justify-center rounded-sm border text-[8px] leading-none ${FORM_TIERS[tier].class}`}
                  >
                    {FORM_TIERS[tier].glyph}
                  </span>
                  {label}
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
