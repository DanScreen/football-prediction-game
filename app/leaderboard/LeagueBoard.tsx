import Link from "next/link"
import {
  computeLeaderboard,
  computeLeagueForm,
  listPlayedRounds,
  type FormTier,
  type PointsBreakdown,
} from "@/lib/leaderboard"
import { AnimatedPoints } from "./AnimatedPoints"
import { roundHref, selectedRound, type SearchParams } from "./roundNav"
import { podiumRank } from "./podium"

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

/** One half of the Overall / Gameweek switch. */
function ModeTab({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      // The page stacks several leagues, so scrolling back to the top on every
      // click would throw the reader away from the table they are using.
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
        active ? "bg-pitch text-white" : "text-ink-mid hover:bg-chip"
      }`}
    >
      {children}
    </Link>
  )
}

/**
 * One end of the gameweek stepper. Renders as plain text at the ends of the
 * season rather than disappearing, so the control keeps its width and the round
 * name doesn't jump sideways as you step.
 */
function StepArrow({
  href,
  label,
  glyph,
}: {
  href: string | null
  label: string
  glyph: string
}) {
  const shape = "flex h-7 w-7 items-center justify-center rounded-full text-sm"
  if (!href) {
    return (
      <span aria-hidden="true" className={`${shape} text-ink-faint`}>
        {glyph}
      </span>
    )
  }
  return (
    <Link href={href} scroll={false} aria-label={label} className={`${shape} text-ink-mid hover:bg-chip`}>
      <span aria-hidden="true">{glyph}</span>
    </Link>
  )
}

type Props = {
  leagueId: string
  leagueName: string
  competitionName: string
  currentUserId: string
  /** Rendered as a section heading only when the user is in more than one league. */
  showHeading: boolean
  /** The page's query params, which carry this league's gameweek selection. */
  searchParams: SearchParams
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
  searchParams,
}: Props) {
  // Which rounds exist has to be known before the table can be scored, because
  // it decides whether the URL's round is one anybody actually played.
  const playedRounds = await listPlayedRounds(leagueId)
  const round = selectedRound(searchParams, leagueId, playedRounds)

  const [ranked, form] = await Promise.all([
    computeLeaderboard(leagueId, round ? { round } : {}),
    // Form is last-five-rounds by definition, so it means nothing inside a
    // single round. Skipping the query also keeps the round view cheaper.
    round ? Promise.resolve(null) : computeLeagueForm(leagueId),
  ])

  const last5Rounds = form?.rounds ?? []
  const formForUser = (userId: string) => form?.byUser.get(userId) ?? []

  // `playedRounds` is newest first, so stepping *back* through the season means
  // walking forwards through the array.
  const roundIndex = round ? playedRounds.indexOf(round) : -1
  const olderRound = round ? (playedRounds[roundIndex + 1] ?? null) : null
  const newerRound = roundIndex > 0 ? playedRounds[roundIndex - 1] : null

  const rankDisplay = (i: number) => {
    const podium = podiumRank(ranked[i])
    return podium === 1 ? "🥇" : podium === 2 ? "🥈" : podium === 3 ? "🥉" : ranked[i].rank
  }

  // Podium rows fade from a gold-ish tint down to the plain surface. Tinting by
  // opacity of one token keeps the ramp readable in both themes — stock oranges
  // and ambers turned to mud on the dark ground.
  const rowBg = (i: number) => {
    switch (podiumRank(ranked[i])) {
      case 1:
        return "bg-clock-tint hover:bg-clock-tint/70"
      case 2:
        return "bg-chip/60 hover:bg-chip"
      case 3:
        return "bg-clock-tint/40 hover:bg-clock-tint/60"
      default:
        return "hover:bg-ground"
    }
  }

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

      {playedRounds.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div
            role="group"
            aria-label={`${leagueName} leaderboard view`}
            className="inline-flex rounded-full border border-line-strong p-0.5"
          >
            <ModeTab href={roundHref(searchParams, leagueId, null)} active={round === null}>
              Overall
            </ModeTab>
            {/* Entering gameweek mode lands on the latest round played, which is
                what someone clicking "Gameweek" almost always wants to see. */}
            <ModeTab
              href={roundHref(searchParams, leagueId, round ?? playedRounds[0])}
              active={round !== null}
            >
              Gameweek
            </ModeTab>
          </div>

          {round !== null && (
            <div className="flex items-center gap-1">
              <StepArrow
                href={olderRound ? roundHref(searchParams, leagueId, olderRound) : null}
                label={olderRound ? `Show ${olderRound}` : "No earlier gameweek"}
                glyph="‹"
              />
              <span className="min-w-28 text-center text-xs font-semibold text-ink" aria-live="polite">
                {round}
              </span>
              <StepArrow
                href={newerRound ? roundHref(searchParams, leagueId, newerRound) : null}
                label={newerRound ? `Show ${newerRound}` : "No later gameweek"}
                glyph="›"
              />
            </div>
          )}
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
              {leagueName} {round ? `${round} standings` : "standings"}, ranked by
              confirmed points
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
