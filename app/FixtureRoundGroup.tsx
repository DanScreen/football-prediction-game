/**
 * A collapsible gameweek section.
 *
 * A full Premier League round is 10 fixtures and the page shows the next few rounds
 * at once, so a flat list ran to 20+ cards. Grouping alone wasn't enough — the
 * rounds you can't act on yet are collapsed, leaving the nearest one open.
 *
 * Built on native `<details>`: no client JS, keyboard accessible, and it still works
 * inside a server component.
 */
export default function FixtureRoundGroup({
  round,
  competitionName,
  kickoff,
  count,
  outstanding,
  defaultOpen,
  children,
}: {
  round: string
  competitionName: string
  kickoff: Date
  count: number
  /** Fixtures in this round with no prediction yet. Omit where it doesn't apply. */
  outstanding?: number
  defaultOpen: boolean
  children: React.ReactNode
}) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card transition-colors hover:bg-chip/40">
        <span
          aria-hidden="true"
          className="text-ink-faint transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-ink">{round}</span>
          <span className="block truncate text-xs text-ink-muted">
            {competitionName} · {count} fixture{count !== 1 ? "s" : ""} · from{" "}
            {new Date(kickoff).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </span>
        </span>
        {outstanding !== undefined && outstanding > 0 && (
          <span className="shrink-0 rounded-full border border-clock-line bg-clock-tint px-2 py-0.5 text-xs font-semibold text-clock">
            {outstanding} to predict
          </span>
        )}
        {outstanding === 0 && (
          <span className="shrink-0 text-xs font-medium text-pitch">All predicted ✓</span>
        )}
      </summary>
      <div className="space-y-3 pt-3">{children}</div>
    </details>
  )
}

type Groupable = {
  competitionId: string
  round: string
  kickoffTime: Date
  competition: { name: string }
}

export type FixtureRound<T> = {
  key: string
  round: string
  competitionName: string
  kickoff: Date
  fixtures: T[]
}

/**
 * Group fixtures into rounds, preserving the order they arrive in.
 *
 * Keyed by competition *and* round: someone in leagues on two competitions can have
 * a "Matchweek 1" in each, which would otherwise merge into one section.
 */
export function groupByRound<T extends Groupable>(fixtures: T[]): FixtureRound<T>[] {
  const groups: FixtureRound<T>[] = []
  const byKey = new Map<string, FixtureRound<T>>()

  for (const f of fixtures) {
    const key = `${f.competitionId}·${f.round}`
    let group = byKey.get(key)
    if (!group) {
      group = {
        key,
        round: f.round,
        competitionName: f.competition.name,
        kickoff: f.kickoffTime,
        fixtures: [],
      }
      byKey.set(key, group)
      groups.push(group)
    }
    group.fixtures.push(f)
    if (f.kickoffTime < group.kickoff) group.kickoff = f.kickoffTime
  }

  return groups
}
