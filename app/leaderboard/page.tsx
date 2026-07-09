import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { computeLeaderboard } from "@/lib/leaderboard"
import { AnimatedPoints } from "./AnimatedPoints"

type FormColor = "green" | "yellow" | "red" | "grey"

function formColorClass(c: FormColor) {
  return {
    green: "bg-green-500",
    yellow: "bg-yellow-400",
    red: "bg-red-500",
    grey: "bg-line",
  }[c]
}

export default async function LeaderboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await getActiveLeagueId()
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

  const formForUser = (userId: string): FormColor[] => {
    const byRound = roundStatsByUser.get(userId)
    return last5Rounds.map((round) => {
      const s = byRound?.get(round)
      if (!s || s.count === 0) return "grey"
      const pct = s.scored / (s.count * 3)
      if (pct > 0.4) return "green"
      if (pct > 0.2) return "yellow"
      return "red"
    })
  }

  const rankDisplay = (i: number) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ranked[i].rank

  const rowBg = (i: number) =>
    i === 0
      ? "bg-amber-50 hover:bg-amber-100"
      : i === 1
        ? "bg-chip/60 hover:bg-chip"
        : i === 2
          ? "bg-orange-50 hover:bg-orange-100"
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
                    <th className="text-right px-4 py-3 hidden md:table-cell font-semibold text-board-muted">
                      Form{" "}
                      <span className="normal-case font-normal opacity-70">
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
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="flex justify-end gap-1">
                            {form.map((color, j) => (
                              <span
                                key={j}
                                title={last5Rounds[j]}
                                className={`w-4 h-4 rounded-sm ${formColorClass(color)}`}
                              />
                            ))}
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
            <div className="hidden md:flex items-center gap-5 text-xs text-ink-muted px-1">
              <span className="font-semibold text-ink-mid">Form key:</span>
              {(
                [
                  ["bg-green-500", ">40% of pts"],
                  ["bg-yellow-400", "21–40%"],
                  ["bg-red-500", "≤20%"],
                  ["bg-line", "No picks"],
                ] as const
              ).map(([cls, label]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`w-3 h-3 rounded-sm inline-block ${cls}`} />
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
