import { scoreOnePrediction, awardedPoints } from "@/lib/scoring"
import { provisionalScore, provisionalPoints } from "@/lib/provisional"
import { FixtureStatus } from "@/app/generated/prisma/client"
import BankerTag from "@/app/components/BankerTag"

type Fixture = {
  id: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
  status: FixtureStatus
  actualHomeScore: number | null
  actualAwayScore: number | null
  proposedHomeScore: number | null
  proposedAwayScore: number | null
  competition: { name: string }
}

export type HistoryPrediction = {
  id: string
  predictedHomeScore: number
  predictedAwayScore: number
  isBanker: boolean
  fixture: Fixture
}

function baseScoreOf(p: HistoryPrediction): number | null {
  const f = p.fixture
  return f.status === FixtureStatus.COMPLETED && f.actualHomeScore !== null && f.actualAwayScore !== null
    ? scoreOnePrediction(p.predictedHomeScore, p.predictedAwayScore, f.actualHomeScore, f.actualAwayScore)
    : null
}

/**
 * What the pick actually scored — base, doubled if it was the round's banker.
 * The base figure is still needed alongside it: the badge colour and the
 * "Nailed it!" flag key off *which* outcome it was (exact / diff / result),
 * and a doubled 3 would otherwise read as an ordinary 6.
 */
function awardedScoreOf(p: HistoryPrediction): number | null {
  const base = baseScoreOf(p)
  return base === null ? null : awardedPoints(base, p.isBanker)
}

/**
 * Settled picks grouped by round, newest first.
 *
 * Rounds are keyed by competition *and* round name, because a user in leagues on
 * two competitions can have same-named rounds (e.g. "Matchweek 1") in both, which
 * would otherwise collapse into one section.
 */
export default function PredictionHistory({
  predictions,
  bonusByRound,
}: {
  predictions: HistoryPrediction[]
  /** Grand Slam points keyed by `${competitionName}·${round}`. */
  bonusByRound: Map<string, number>
}) {
  type Round = { key: string; round: string; competitionName: string; predictions: HistoryPrediction[] }
  const rounds: Round[] = []
  const byKey = new Map<string, Round>()

  for (const p of predictions) {
    const key = `${p.fixture.competition.name}·${p.fixture.round}`
    let r = byKey.get(key)
    if (!r) {
      r = { key, round: p.fixture.round, competitionName: p.fixture.competition.name, predictions: [] }
      byKey.set(key, r)
      rounds.push(r)
    }
    r.predictions.push(p)
  }

  const roundStats = rounds.map((r) => {
    const scored = r.predictions.map(awardedScoreOf).filter((s): s is number => s !== null)
    const provisional = r.predictions
      .map((p) => provisionalPoints(p, p.fixture))
      .filter((s): s is number => s !== null)
    const bonus = bonusByRound.get(r.key) ?? 0
    return {
      ...r,
      scoredCount: scored.length,
      subtotal: scored.reduce((a, b) => a + b, 0) + bonus,
      provisionalSubtotal: provisional.reduce((a, b) => a + b, 0),
      bonus,
    }
  })

  return (
    <div className="space-y-8">
      {roundStats.map((r) => (
        <section key={r.key}>
          <div className="flex items-baseline justify-between mb-2 px-1">
            <h3 className="text-sm font-bold text-ink-mid uppercase tracking-wide">
              {r.competitionName} · {r.round}
            </h3>
            {r.scoredCount > 0 ? (
              <p className="text-sm text-ink-muted">
                {r.bonus > 0 && (
                  <span className="text-clock font-semibold mr-2">🏆 Grand Slam +{r.bonus}</span>
                )}
                <span className="font-bold text-ink tabular-nums">{r.subtotal}</span> pts
              </p>
            ) : (
              r.provisionalSubtotal > 0 && (
                <p className="text-sm text-clock font-semibold tabular-nums">
                  {r.provisionalSubtotal} pts prov.
                </p>
              )
            )}
          </div>

          <div className="space-y-2">
            {r.predictions.map((p) => {
              const f = p.fixture
              const isCompleted = f.status === FixtureStatus.COMPLETED
              const baseScore = baseScoreOf(p)
              const awarded = awardedScoreOf(p)
              const provScore = provisionalScore(f)
              const provPts = provisionalPoints(p, f)

              const accentBorder =
                baseScore === 3
                  ? "border-l-good"
                  : baseScore === 0
                    ? "border-l-bad"
                    : baseScore !== null
                      ? "border-l-info"
                      : provScore !== null
                        ? "border-l-clock"
                        : "border-l-line-strong"

              return (
                <div
                  key={p.id}
                  className={`bg-surface rounded-xl shadow-card border border-line border-l-4 ${accentBorder} px-5 py-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink truncate">
                        {f.homeTeam} <span className="text-ink-faint font-normal">vs</span>{" "}
                        {f.awayTeam}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5">
                        {new Date(f.kickoffTime).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-5 shrink-0">
                      <div>
                        <p className="text-xs text-ink-faint mb-0.5">My pick</p>
                        <p className="score-digits text-lg">
                          {p.predictedHomeScore} – {p.predictedAwayScore}
                        </p>
                        {p.isBanker && (
                          <span className="mt-0.5 block">
                            <BankerTag />
                          </span>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-ink-faint mb-0.5">Result</p>
                        {isCompleted ? (
                          <p className="score-digits text-lg">
                            {f.actualHomeScore} – {f.actualAwayScore}
                          </p>
                        ) : provScore !== null ? (
                          <div>
                            <p className="score-digits text-lg text-clock">
                              {provScore.home} – {provScore.away}
                            </p>
                            <p className="text-[10px] font-semibold text-clock uppercase tracking-wide -mt-0.5">
                              Provisional
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-ink-faint italic">Pending</p>
                        )}
                      </div>

                      <div className="min-w-[3rem]">
                        <p className="text-xs text-ink-faint mb-0.5">Pts</p>
                        {isCompleted && baseScore !== null && awarded !== null ? (
                          <div className="flex flex-col items-start gap-1">
                            <PointsBadge points={awarded} tone={baseScore} />
                            {baseScore === 3 && (
                              <span className="text-xs font-bold text-good bg-good-tint border border-good-line rounded-full px-2 py-0.5 animate-pop whitespace-nowrap">
                                Nailed it! ⚽
                              </span>
                            )}
                          </div>
                        ) : provPts !== null ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-sm font-bold bg-clock-tint text-clock border border-clock/25">
                            {provPts}
                          </span>
                        ) : (
                          <p className="text-sm text-ink-faint">–</p>
                        )}
                      </div>
                    </div>
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
