import { scoreOnePrediction, awardedPoints } from "@/lib/scoring"
import { FixtureStatus } from "@/app/generated/prisma/client"
import BankerTag from "@/app/components/BankerTag"
import PickGroups from "@/app/components/PickGroups"
import PointsBadge from "@/app/components/PointsBadge"
import TeamChip from "@/app/components/TeamChip"

type Fixture = {
  id: string
  competitionId: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
  status: FixtureStatus
  actualHomeScore: number | null
  actualAwayScore: number | null
  competition: { name: string }
}

export type HistoryPredictionRow = {
  id: string
  userId: string
  predictedHomeScore: number
  predictedAwayScore: number
  isBanker: boolean
  pointsAwarded: number | null
  user: { id: string; displayName: string; isBot: boolean }
}

export type HistoryFixture = Fixture & {
  predictions: HistoryPredictionRow[]
}

function baseScoreOf(
  p: Pick<HistoryPredictionRow, "predictedHomeScore" | "predictedAwayScore">,
  f: Pick<Fixture, "actualHomeScore" | "actualAwayScore">,
): number | null {
  return f.actualHomeScore !== null && f.actualAwayScore !== null
    ? scoreOnePrediction(
        p.predictedHomeScore,
        p.predictedAwayScore,
        f.actualHomeScore,
        f.actualAwayScore,
      )
    : null
}

function awardedScoreOf(p: HistoryPredictionRow, f: Fixture): number | null {
  if (p.pointsAwarded !== null) return p.pointsAwarded
  const base = baseScoreOf(p, f)
  return base === null ? null : awardedPoints(base, p.isBanker)
}

/** Why a pick scored what it did, so nobody needs the rules page to read a 1.5. */
const REASON: Record<number, { text: string; class: string }> = {
  1.5: { text: "One goal out", class: "text-info" },
  1: { text: "Right result", class: "text-ink-muted" },
  0: { text: "Wrong result", class: "text-ink-muted" },
}

/**
 * Settled fixtures grouped by round, newest first.
 *
 * Each card leads with the scoreline, then the viewer's pick and why it scored
 * what it did, then every league-mate's pick on that competition grouped by
 * scoreline (same visibility as Kicked Off). Rounds are keyed by competition
 * *and* round name.
 */
export default function PredictionHistory({
  fixtures,
  userId,
  bonusByRound,
}: {
  fixtures: HistoryFixture[]
  userId: string
  /** Streak-bonus points keyed by `${competitionName}·${round}`. */
  bonusByRound: Map<string, number>
}) {
  type Round = {
    key: string
    round: string
    competitionName: string
    fixtures: HistoryFixture[]
    latestKickoff: Date
  }
  const rounds: Round[] = []
  const byKey = new Map<string, Round>()

  for (const f of fixtures) {
    const key = `${f.competition.name}·${f.round}`
    let r = byKey.get(key)
    if (!r) {
      r = {
        key,
        round: f.round,
        competitionName: f.competition.name,
        fixtures: [],
        latestKickoff: f.kickoffTime,
      }
      byKey.set(key, r)
      rounds.push(r)
    }
    r.fixtures.push(f)
    if (f.kickoffTime > r.latestKickoff) r.latestKickoff = f.kickoffTime
  }

  rounds.sort((a, b) => b.latestKickoff.getTime() - a.latestKickoff.getTime())

  const roundStats = rounds.map((r) => {
    const myPredictions = r.fixtures.flatMap((f) =>
      f.predictions.filter((p) => p.userId === userId).map((p) => ({ p, f })),
    )
    const subtotal = myPredictions.reduce((sum, { p, f }) => {
      const awarded = awardedScoreOf(p, f)
      return awarded === null ? sum : sum + awarded
    }, 0)
    const bonus = bonusByRound.get(r.key) ?? 0
    return { ...r, subtotal: subtotal + bonus, bonus, myPickCount: myPredictions.length }
  })

  return (
    <div className="space-y-8">
      {roundStats.map((r) => (
        <section key={r.key}>
          <div className="flex items-baseline justify-between mb-2 px-1">
            <h3 className="text-sm font-bold text-ink-mid uppercase tracking-wide">
              {r.competitionName} · {r.round}
            </h3>
            {r.myPickCount > 0 ? (
              <p className="text-sm text-ink-muted">
                {r.bonus > 0 && (
                  <span className="text-clock font-semibold mr-2">🔥 Streak bonus +{r.bonus}</span>
                )}
                <span className="font-bold text-ink tabular-nums">{r.subtotal}</span> pts
                <span className="text-ink-faint font-normal"> · you</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            {r.fixtures
              .sort((a, b) => b.kickoffTime.getTime() - a.kickoffTime.getTime())
              .map((f) => {
                const myPick = f.predictions.find((p) => p.userId === userId)
                const baseScore = myPick ? baseScoreOf(myPick, f) : null
                const myAwarded = myPick ? awardedScoreOf(myPick, f) : null
                const others = f.predictions
                  .filter((p) => p.userId !== userId)
                  .map((p) => ({
                    id: p.id,
                    displayName: p.user.displayName,
                    isBot: p.user.isBot,
                    isBanker: p.isBanker,
                    homeScore: p.predictedHomeScore,
                    awayScore: p.predictedAwayScore,
                    pointsAwarded: awardedScoreOf(p, f),
                    provisionalPoints: null,
                  }))

                const accentBorder =
                  baseScore === 3
                    ? "border-l-good"
                    : baseScore === 0
                      ? "border-l-bad"
                      : baseScore !== null
                        ? "border-l-info"
                        : "border-l-line-strong"

                return (
                  <div
                    key={f.id}
                    className={`bg-surface rounded-xl shadow-card border border-line border-l-4 ${accentBorder} overflow-hidden`}
                  >
                    <div className="px-5 pt-3 pb-4">
                      <p className="text-xs text-ink-muted">
                        {new Date(f.kickoffTime).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>

                      {/* The scoreline is the headline: teams either side of the score. */}
                      <div className="mt-2 flex items-center gap-2 sm:gap-3">
                        <p className="flex min-w-0 flex-1 items-center justify-end gap-2 text-[15px] font-bold text-ink">
                          <span className="truncate">{f.homeTeam}</span>
                          <TeamChip team={f.homeTeam} />
                        </p>
                        <p className="score-digits shrink-0 rounded-lg bg-board px-3 py-1 text-xl text-board-fore">
                          <span className="sr-only">Result: </span>
                          {f.actualHomeScore} – {f.actualAwayScore}
                        </p>
                        <p className="flex min-w-0 flex-1 items-center gap-2 text-[15px] font-bold text-ink">
                          <TeamChip team={f.awayTeam} />
                          <span className="truncate">{f.awayTeam}</span>
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                        {myPick ? (
                          <>
                            <span className="font-semibold text-pitch">You</span>
                            <span className="score-digits font-bold text-ink">
                              {myPick.predictedHomeScore} – {myPick.predictedAwayScore}
                            </span>
                            {myPick.isBanker && <BankerTag />}
                            {myAwarded !== null && (
                              <PointsBadge points={myAwarded} tone={baseScore ?? 0} />
                            )}
                            {baseScore === 3 && (
                              <span className="text-xs font-bold text-good bg-good-tint border border-good-line rounded-full px-2 py-0.5 animate-pop whitespace-nowrap">
                                Nailed it! ⚽
                              </span>
                            )}
                            {baseScore !== null && REASON[baseScore] && (
                              <span className={`text-xs font-semibold ${REASON[baseScore].class}`}>
                                {REASON[baseScore].text}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs italic text-ink-faint">
                            You didn&apos;t predict this one.
                          </span>
                        )}
                      </div>

                      {others.length > 0 ? (
                        <div className="mt-3 border-t border-line-soft pt-3">
                          <PickGroups picks={others} settled />
                        </div>
                      ) : (
                        myPick && (
                          <p className="mt-3 border-t border-line-soft pt-3 text-xs italic text-ink-faint">
                            No one else in your leagues predicted this one.
                          </p>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </section>
      ))}
    </div>
  )
}
