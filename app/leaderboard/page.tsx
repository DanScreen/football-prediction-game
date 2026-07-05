import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import { scoreOnePrediction } from "@/lib/scoring"
import { AnimatedPoints } from "./AnimatedPoints"

type FormColor = "green" | "yellow" | "red" | "grey"

function formColorClass(c: FormColor) {
  return {
    green: "bg-green-500",
    yellow: "bg-yellow-400",
    red: "bg-red-500",
    grey: "bg-gray-200",
  }[c]
}

export default async function LeaderboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await getActiveLeagueId()
  if (!activeLeagueId) redirect("/leagues")

  const league = await prisma.league.findUnique({ where: { id: activeLeagueId } })
  if (!league) redirect("/leagues")

  const memberIds = (
    await prisma.leagueMembership.findMany({
      where: { leagueId: activeLeagueId },
      select: { userId: true },
    })
  ).map((m) => m.userId)

  const [users, scoredPredictions, completedFixtures, bonusAwards] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, displayName: true, isBot: true },
    }),
    prisma.prediction.findMany({
      where: {
        userId: { in: memberIds },
        fixture: { leagueId: activeLeagueId },
        pointsAwarded: { not: null },
      },
      select: {
        userId: true,
        pointsAwarded: true,
        predictedHomeScore: true,
        predictedAwayScore: true,
        fixture: {
          select: {
            competition: true,
            round: true,
            kickoffTime: true,
            actualHomeScore: true,
            actualAwayScore: true,
          },
        },
      },
    }),
    prisma.fixture.findMany({
      where: { leagueId: activeLeagueId, status: "COMPLETED" },
      select: { competition: true, round: true, kickoffTime: true },
    }),
    prisma.bonusAward.findMany({
      where: { leagueId: activeLeagueId },
      select: { userId: true, points: true },
    }),
  ])

  // Build last 5 completed rounds (oldest → newest for form strip)
  const roundMaxKickoff = new Map<string, Date>()
  for (const f of completedFixtures) {
    const key = `${f.competition}||${f.round}`
    const existing = roundMaxKickoff.get(key)
    if (!existing || f.kickoffTime > existing) roundMaxKickoff.set(key, f.kickoffTime)
  }

  const last5Rounds = [...roundMaxKickoff.entries()]
    .sort(([, a], [, b]) => b.getTime() - a.getTime())
    .slice(0, 5)
    .reverse()
    .map(([key, maxKickoff]) => {
      const sep = key.indexOf("||")
      return { key, competition: key.slice(0, sep), round: key.slice(sep + 2), maxKickoff }
    })

  const predsByUser = new Map<string, typeof scoredPredictions>()
  for (const p of scoredPredictions) {
    const arr = predsByUser.get(p.userId) ?? []
    arr.push(p)
    predsByUser.set(p.userId, arr)
  }

  const bonusByUser = new Map<string, { points: number; count: number }>()
  for (const b of bonusAwards) {
    const s = bonusByUser.get(b.userId) ?? { points: 0, count: 0 }
    bonusByUser.set(b.userId, { points: s.points + b.points, count: s.count + 1 })
  }

  const entries = users
    .map((user) => {
      const preds = predsByUser.get(user.id) ?? []
      const bonus = bonusByUser.get(user.id) ?? { points: 0, count: 0 }
      const totalPoints =
        preds.reduce((sum, p) => sum + (p.pointsAwarded ?? 0), 0) + bonus.points
      const grandSlams = bonus.count

      const exactCount = preds.filter(
        (p) =>
          p.fixture.actualHomeScore !== null &&
          p.fixture.actualAwayScore !== null &&
          scoreOnePrediction(
            p.predictedHomeScore,
            p.predictedAwayScore,
            p.fixture.actualHomeScore,
            p.fixture.actualAwayScore,
          ) === 3,
      ).length

      const roundStats = new Map<string, { scored: number; count: number }>()
      for (const p of preds) {
        const rk = `${p.fixture.competition}||${p.fixture.round}`
        const s = roundStats.get(rk) ?? { scored: 0, count: 0 }
        roundStats.set(rk, { scored: s.scored + (p.pointsAwarded ?? 0), count: s.count + 1 })
      }

      const form: FormColor[] = last5Rounds.map(({ key }) => {
        const s = roundStats.get(key)
        if (!s || s.count === 0) return "grey"
        const pct = s.scored / (s.count * 3)
        if (pct > 0.4) return "green"
        if (pct > 0.2) return "yellow"
        return "red"
      })

      return { ...user, totalPoints, exactCount, grandSlams, form }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)

  type RankedEntry = (typeof entries)[number] & { rank: number }
  const ranked = entries.reduce<RankedEntry[]>((acc, entry, i) => {
    const rank =
      i === 0 ? 1 : entries[i - 1].totalPoints === entry.totalPoints ? acc[i - 1].rank : i + 1
    acc.push({ ...entry, rank })
    return acc
  }, [])

  const rankDisplay = (i: number) =>
    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : ranked[i].rank

  const rowBg = (i: number) =>
    i === 0
      ? "bg-amber-50 hover:bg-amber-100"
      : i === 1
        ? "bg-slate-50 hover:bg-slate-100"
        : i === 2
          ? "bg-orange-50 hover:bg-orange-100"
          : "hover:bg-gray-50"

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">{league.name}</h1>
      <p className="text-gray-500 text-sm mb-6">
        {entries.length} player{entries.length !== 1 ? "s" : ""}
        {last5Rounds.length > 0 && (
          <>
            {" · "}form: last {last5Rounds.length} round{last5Rounds.length !== 1 ? "s" : ""}
          </>
        )}
      </p>

      {ranked.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🏆</p>
          <p className="font-medium">No players yet.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm mb-4">
            <table className="w-full text-sm">
              <thead className="bg-gray-900 text-white text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3 w-10">#</th>
                  <th className="text-left px-4 py-3">Player</th>
                  <th className="text-right px-4 py-3">Points</th>
                  <th className="text-right px-4 py-3 hidden sm:table-cell">Exact ⚽</th>
                  {last5Rounds.length > 0 && (
                    <th className="text-right px-4 py-3 hidden md:table-cell">
                      Form{" "}
                      <span className="normal-case font-normal text-gray-400">
                        (oldest → newest)
                      </span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ranked.map((entry, i) => (
                  <tr
                    key={entry.id}
                    className={`transition-colors animate-slide-up ${rowBg(i)}`}
                    style={{ animationDelay: `${i * 55}ms` }}
                  >
                    <td className="px-4 py-3 font-bold text-gray-500 tabular-nums text-base">
                      {rankDisplay(i)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-semibold text-gray-900">{entry.displayName}</span>
                      {entry.isBot && (
                        <span className="ml-1.5 text-xs text-gray-400 font-normal">🤖</span>
                      )}
                      {entry.grandSlams > 0 && (
                        <span
                          className="ml-1.5 text-xs font-medium text-amber-600"
                          title={`${entry.grandSlams} Grand Slam${entry.grandSlams !== 1 ? "s" : ""}`}
                        >
                          🏆{entry.grandSlams > 1 ? `×${entry.grandSlams}` : ""}
                        </span>
                      )}
                      {entry.id === session.user.id && (
                        <span className="ml-1.5 text-xs text-[#1a7a3c] font-medium">(you)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900 text-base">
                      <AnimatedPoints value={entry.totalPoints} />
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell tabular-nums">
                      {entry.exactCount}
                    </td>
                    {last5Rounds.length > 0 && (
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex justify-end gap-1">
                          {entry.form.map((color, j) => (
                            <span
                              key={j}
                              title={`${last5Rounds[j].competition} · ${last5Rounds[j].round}`}
                              className={`w-4 h-4 rounded-sm ${formColorClass(color)}`}
                            />
                          ))}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {last5Rounds.length > 0 && (
            <div className="hidden md:flex items-center gap-5 text-xs text-gray-500 px-1">
              <span className="font-semibold text-gray-700">Form key:</span>
              {(
                [
                  ["bg-green-500", ">40% of pts"],
                  ["bg-yellow-400", "21–40%"],
                  ["bg-red-500", "≤20%"],
                  ["bg-gray-200", "No picks"],
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
