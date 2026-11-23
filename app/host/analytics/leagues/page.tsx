import Link from "next/link"
import {
  LEAGUE_HEALTH,
  RECENT_ROUNDS,
  computeLeagueStats,
  type LeagueStats,
} from "@/lib/analytics/compute"
import { loadAnalyticsDataset } from "@/lib/analytics/load"
import { HealthBadge, MiniRounds, formatDate, pct, share } from "../ui"

export const metadata = { title: "Groups · Analytics" }

const SIZES = [
  { key: "all", label: "All" },
  { key: "multi", label: "2+ players" },
  { key: "solo", label: "Solo" },
] as const
type Size = (typeof SIZES)[number]["key"]

const SORTS = {
  players: { label: "Players", by: (l: LeagueStats) => l.humans },
  picking: { label: "Picking", by: (l: LeagueStats) => l.activePickers },
  participation: { label: "Per GW", by: (l: LeagueStats) => l.participation ?? -1 },
  active: { label: "Active 7d", by: (l: LeagueStats) => l.activeMembers7d },
  picks: { label: "Picks", by: (l: LeagueStats) => l.picks },
  created: { label: "Created", by: (l: LeagueStats) => l.league.createdAt.getTime() },
} as const
type Sort = keyof typeof SORTS

function parse<T extends string>(value: string | undefined, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export default async function AnalyticsLeaguesPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; sort?: string; q?: string }>
}) {
  const params = await searchParams
  const size = parse<Size>(params.size, ["all", "multi", "solo"], "all")
  const sort = parse<Sort>(params.sort, Object.keys(SORTS) as Sort[], "players")
  const query = params.q?.trim().slice(0, 100) ?? ""

  const ds = await loadAnalyticsDataset()
  const all = computeLeagueStats(ds)
  const counts = {
    all: all.length,
    multi: all.filter((l) => l.humans >= 2).length,
    solo: all.filter((l) => l.humans <= 1).length,
  }
  const rows = all
    .filter((l) => (size === "multi" ? l.humans >= 2 : size === "solo" ? l.humans <= 1 : true))
    .filter((l) => !query || l.league.name.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => SORTS[sort].by(b) - SORTS[sort].by(a) || a.league.name.localeCompare(b.league.name))

  const href = (changes: { size?: Size; sort?: Sort }) => {
    const p = new URLSearchParams()
    const s = changes.size ?? size
    const o = changes.sort ?? sort
    if (s !== "all") p.set("size", s)
    if (o !== "players") p.set("sort", o)
    if (query) p.set("q", query)
    const qs = p.toString()
    return qs ? `/host/analytics/leagues?${qs}` : "/host/analytics/leagues"
  }

  const sortHeader = (k: Sort, className = "") => (
    <th className={`px-3 py-3 text-right font-semibold ${className}`} key={k}>
      <Link
        aria-current={sort === k ? "true" : undefined}
        className={sort === k ? "text-ink" : "hover:text-ink"}
        href={href({ sort: k })}
      >
        {SORTS[k].label}
        {sort === k ? " ↓" : ""}
      </Link>
    </th>
  )

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Filter groups by size" className="flex gap-1 rounded-lg bg-chip p-1 text-sm">
          {SIZES.map((s) => (
            <Link
              aria-current={size === s.key ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                size === s.key ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
              }`}
              href={href({ size: s.key })}
              key={s.key}
            >
              {s.label} <span className="tabular-nums text-ink-faint">{counts[s.key]}</span>
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" method="get">
          {size !== "all" && <input name="size" type="hidden" value={size} />}
          {sort !== "players" && <input name="sort" type="hidden" value={sort} />}
          <input
            aria-label="Search groups"
            className="w-full rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm sm:w-56"
            defaultValue={query}
            name="q"
            placeholder="Group name"
            type="search"
          />
          <button
            className="rounded-md bg-pitch px-3 py-1.5 text-sm font-semibold text-pitch-on transition-colors hover:bg-pitch-deep"
            type="submit"
          >
            Search
          </button>
        </form>
      </div>

      <p className="mb-3 text-xs text-ink-muted">
        <strong className="font-semibold text-ink-mid">Players</strong> are human members.{" "}
        <strong className="font-semibold text-ink-mid">Picking</strong> means they picked in at least
        one of the competition&apos;s last {RECENT_ROUNDS} gameweeks;{" "}
        <strong className="font-semibold text-ink-mid">Per GW</strong> is the average share of members
        who picked each of those gameweeks (bars, oldest first). Health:{" "}
        {Object.values(LEAGUE_HEALTH)
          .map((h) => `${h.label.toLowerCase()} — ${h.description.toLowerCase()}`)
          .join("; ")}
        .
      </p>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-sm text-ink-muted shadow-card">
          {query ? `No groups match “${query}”.` : "No groups here."}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Group</th>
                {sortHeader("players")}
                {sortHeader("picking")}
                {sortHeader("participation")}
                <th className="px-3 py-3 font-semibold">Last {RECENT_ROUNDS}</th>
                {sortHeader("active")}
                {sortHeader("picks")}
                <th className="px-3 py-3 font-semibold">Health</th>
                {sortHeader("created", "pr-4")}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr className="border-b border-line-soft last:border-0" key={l.league.id}>
                  <td className="min-w-[14rem] px-4 py-3">
                    <Link
                      className="font-medium text-ink hover:text-pitch hover:underline"
                      href={`/host/analytics/leagues/${l.league.id}`}
                    >
                      {l.league.name}
                    </Link>
                    <p className="text-xs text-ink-faint">
                      {l.competition?.flag} {l.competition?.name}
                      {l.commissioners.length > 0 ? ` · run by ${l.commissioners.join(", ")}` : ""}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">
                    {l.humans}
                    {l.bots > 0 ? <span className="text-xs text-ink-faint"> +{l.bots}🤖</span> : null}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">
                    {l.activePickers}
                    <span className="text-xs text-ink-faint"> /{l.members}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{pct(l.participation)}</td>
                  <td className="px-3 py-3">
                    <MiniRounds
                      values={l.recentRounds.map((r) => ({
                        label: r.round.label,
                        value: share(r.played, r.eligible),
                      }))}
                    />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{l.activeMembers7d}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-ink">{l.picks}</td>
                  <td className="px-3 py-3">
                    <HealthBadge health={l.health} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 pr-4 text-right text-ink-muted">
                    {formatDate(l.league.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
