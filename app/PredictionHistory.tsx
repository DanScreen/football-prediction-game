import { scoreOnePrediction, awardedPoints } from "@/lib/scoring"
import { FixtureStatus } from "@/app/generated/prisma/client"
import BankerTag from "@/app/components/BankerTag"

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

function sortPredictions(predictions: HistoryPredictionRow[], userId: string) {
  return [...predictions].sort((a, b) => {
    if (a.userId === userId) return -1
    if (b.userId === userId) return 1
    return a.user.displayName.localeCompare(b.user.displayName, "en")
  })
}

/**
 * Settled fixtures grouped by round, newest first.
 *
 * Each fixture lists every league-mate's pick on that competition (same visibility
 * as Kicked Off). Rounds are keyed by competition *and* round name.
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
                const visible = sortPredictions(f.predictions, userId)

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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-line-soft">
                      <div className="min-w-0">
                        <p className="font-bold text-ink truncate">
                          {f.homeTeam}{" "}
                          <span className="text-ink-faint font-normal">vs</span> {f.awayTeam}
                        </p>
                        <p className="text-xs text-ink-muted mt-0.5">
                          {new Date(f.kickoffTime).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>

                      <div className="shrink-0">
                        <p className="text-xs text-ink-faint mb-0.5">Result</p>
                        <p className="score-digits text-lg">
                          {f.actualHomeScore} – {f.actualAwayScore}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 py-3 space-y-2">
                      {visible.map((p) => {
                        const base = baseScoreOf(p, f)
                        const awarded = awardedScoreOf(p, f)
                        const isYou = p.userId === userId

                        return (
                          <div
                            key={p.id}
                            className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-sm ${
                              isYou ? "text-ink" : "text-ink-muted"
                            }`}
                          >
                            <span
                              className={`w-28 truncate ${isYou ? "font-semibold text-pitch" : ""}`}
                            >
                              {isYou ? "You" : `${p.user.isBot ? "🤖 " : ""}${p.user.displayName}`}
                            </span>
                            <span className="font-bold tabular-nums score-digits">
                              {p.predictedHomeScore} – {p.predictedAwayScore}
                            </span>
                            {p.isBanker && <BankerTag />}
                            {awarded !== null ? (
                              <PointsBadge points={awarded} tone={base ?? 0} />
                            ) : (
                              <span className="text-xs text-ink-faint">–</span>
                            )}
                            {isYou && base === 3 && (
                              <span className="text-xs font-bold text-good bg-good-tint border border-good-line rounded-full px-2 py-0.5 animate-pop whitespace-nowrap">
                                Nailed it! ⚽
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {visible.length === 0 && (
                        <p className="text-xs text-ink-faint italic">No predictions submitted.</p>
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

/** `points` is what's scored; `tone` is the undoubled base that picks the colour. */
function PointsBadge({ points, tone }: { points: number; tone: number }) {
  const color =
    tone === 3
      ? "bg-good-tint text-good border border-good-line"
      : tone === 1.5
        ? "bg-info-tint text-info border border-info-line"
        : tone === 1
          ? "bg-clock-tint text-clock border border-clock-line"
          : "bg-chip text-ink-muted border border-line"

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-sm font-bold ${color}`}>
      {points}
    </span>
  )
}
