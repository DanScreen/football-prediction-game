import Link from "next/link"
import { ACTIVITY_TRACKING_STARTED, activityDayKey } from "@/lib/activity"
import {
  RECENT_ROUNDS,
  SEGMENTS,
  buildIndex,
  competitionRoundStats,
  computeLeagueStats,
  computePlayerStats,
  dailyActive,
  engagementFunnel,
  returnFrequency,
  stickiness,
  weekOverWeekReturn,
  weeklyRetention,
} from "@/lib/analytics/compute"
import { loadAnalyticsDataset } from "@/lib/analytics/load"
import {
  BarList,
  Card,
  ColumnChart,
  HealthBadge,
  HeatLegend,
  Section,
  StatTile,
  TableView,
  daysAgo,
  formatDay,
  heat,
  heatText,
  pct,
  share,
} from "./ui"

export const metadata = { title: "Analytics" }

const RANGES = [30, 90, 180] as const
type Range = (typeof RANGES)[number]
const COHORTS = 8
const GAMEWEEKS = 10

function parseRange(value: string | undefined): Range {
  const n = Number(value)
  return (RANGES as readonly number[]).includes(n) ? (n as Range) : 30
}

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const range = parseRange((await searchParams).range)
  const ds = await loadAnalyticsDataset()
  const index = buildIndex(ds)
  const today = activityDayKey(ds.now)

  const allPlayers = computePlayerStats(ds, index)
  const players = allPlayers.filter((p) => !p.user.isBot)
  const bots = allPlayers.length - players.length
  const humanIds = new Set(players.map((p) => p.user.id))
  const isHuman = (id: string) => humanIds.has(id)
  const leagues = computeLeagueStats(ds, index)

  // ── Headline numbers
  const inLeague = players.filter((p) => p.leagueCount > 0)
  const picking = players.filter((p) => p.recentPlayed > 0)
  const weekly = players.filter((p) => p.activeDays7 > 0)
  const monthly = players.filter((p) => p.activeDays30 > 0)
  const wow = weekOverWeekReturn(ds, isHuman)
  const sticky = stickiness(ds, 30, isHuman)
  const avgDays =
    monthly.length > 0 ? monthly.reduce((s, p) => s + p.activeDays30, 0) / monthly.length : null
  const multiPlayer = leagues.filter((l) => l.humans >= 2)
  const healthy = leagues.filter((l) => l.health === "thriving" || l.health === "active")
  const weekAgo = ds.now.getTime() - 7 * 86_400_000
  const picks7d = ds.predictions.filter((p) => isHuman(p.userId) && p.createdAt.getTime() >= weekAgo).length

  // ── Charts
  const daily = dailyActive(ds, range, isHuman)
  const labelEvery = range === 30 ? 7 : range === 90 ? 14 : 30
  const funnel = engagementFunnel(players)
  const segments = SEGMENTS.map((s) => ({
    ...s,
    count: players.filter((p) => p.segment === s.key).length,
  }))
  const frequency = returnFrequency(players)
  const reach = {
    web: players.filter((p) => p.surfaces30.web).length,
    app: players.filter((p) => p.surfaces30.app).length,
    api: allPlayers.filter((p) => p.surfaces30.api).length,
  }
  const cohorts = weeklyRetention(ds, COHORTS, (u) => !u.isBot)

  const activeCompetitions = ds.competitions.filter(
    (c) => !c.archivedAt && ds.leagues.some((l) => l.competitionId === c.id),
  )
  const gameweeks = activeCompetitions.map((c) => ({
    competition: c,
    rounds: competitionRoundStats(ds, index, c.id, GAMEWEEKS, isHuman),
  }))

  const sizeBuckets = [
    { label: "Solo (1 player)", test: (n: number) => n <= 1 },
    { label: "2–4 players", test: (n: number) => n >= 2 && n <= 4 },
    { label: "5–9 players", test: (n: number) => n >= 5 && n <= 9 },
    { label: "10+ players", test: (n: number) => n >= 10 },
  ].map((b) => ({ label: b.label, count: leagues.filter((l) => b.test(l.humans)).length }))
  const topGroups = [...leagues]
    .filter((l) => l.health !== "finished")
    .sort((a, b) => b.activePickers - a.activePickers || b.humans - a.humans)
    .slice(0, 8)

  const slipping = players
    .filter((p) => p.missStreak >= 2 && p.roundsPlayed >= 3 && p.segment !== "no-league")
    .sort((a, b) => b.roundsPlayed - a.roundsPlayed)
    .slice(0, 10)

  return (
    <>
      <Section title="Headlines">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            hint={`${inLeague.length} in a league · ${bots} bot${bots === 1 ? "" : "s"} not counted`}
            href="/host/analytics/players"
            label="Players"
            value={players.length}
          />
          <StatTile
            hint={`${pct(share(picking.length, inLeague.length))} of players in a league, last ${RECENT_ROUNDS} gameweeks`}
            href="/host/analytics/players?segment=engaged"
            label="Making picks"
            value={picking.length}
          />
          <StatTile
            hint={
              wow.rate === null
                ? "Nobody was active the week before"
                : `${pct(wow.rate)} of the previous week's came back`
            }
            label="Active this week"
            value={weekly.length}
          />
          <StatTile
            hint={avgDays === null ? "No visits in 30 days" : `Monthly actives visit on ${avgDays.toFixed(1)} days a month`}
            label="Stickiness"
            value={pct(sticky)}
          />
          <StatTile
            hint={`of ${leagues.length} group${leagues.length === 1 ? "" : "s"} have 2+ players`}
            href="/host/analytics/leagues?size=multi"
            label="Multi-player groups"
            value={multiPlayer.length}
          />
          <StatTile
            hint="Thriving or active this month"
            href="/host/analytics/leagues?sort=participation"
            label="Healthy groups"
            value={healthy.length}
          />
          <StatTile hint="Picks made by players in the last 7 days" label="Picks · 7d" value={picks7d} />
          <StatTile
            hint={`Missed their last 2+ gameweeks after playing 3+`}
            label="Slipping away"
            value={players.filter((p) => p.missStreak >= 2 && p.roundsPlayed >= 3).length}
          />
        </div>
      </Section>

      <Section
        action={
          <nav aria-label="Date range" className="flex gap-1 rounded-lg bg-chip p-1 text-xs">
            {RANGES.map((r) => (
              <Link
                aria-current={r === range ? "page" : undefined}
                className={`rounded-md px-2.5 py-1 font-medium ${
                  r === range ? "bg-surface text-ink shadow-card" : "text-ink-muted hover:text-ink"
                }`}
                href={r === 30 ? "/host/analytics" : `/host/analytics?range=${r}`}
                key={r}
              >
                {r}d
              </Link>
            ))}
          </nav>
        }
        description={
          <>
            Players who used Scorers each day, on any surface. Visits are recorded from{" "}
            {formatDay(ACTIVITY_TRACKING_STARTED, true)}; earlier days are reconstructed from picks,
            sign-ups and league joins, so they undercount.
          </>
        }
        title="Daily active players"
      >
        <Card>
          <ColumnChart
            columns={daily.map((d, i) => ({
              label: d.day,
              value: d.returning,
              extra: d.firstVisit,
              axisLabel: (daily.length - 1 - i) % labelEvery === 0 ? formatDay(d.day) : undefined,
              tooltip: `${formatDay(d.day)}: ${d.returning} returning, ${d.firstVisit} first visit`,
            }))}
            legend={["Returning", "First visit"]}
          />
          <TableView
            headers={["Day", "Returning", "First visit", "Total"]}
            rows={[...daily].reverse().map((d) => [
              formatDay(d.day, true),
              d.returning,
              d.firstVisit,
              d.returning + d.firstVisit,
            ])}
          />
        </Card>
      </Section>

      <div className="grid gap-x-6 md:grid-cols-2">
        <Section description="Where players drop off, as a share of everyone who signed up." title="Funnel">
          <Card>
            <BarList
              max={funnel[0].count}
              rows={funnel.map((s) => ({
                label: s.label,
                value: s.count,
                display: (
                  <>
                    {s.count} <span className="text-ink-faint">· {pct(share(s.count, funnel[0].count))}</span>
                  </>
                ),
              }))}
            />
          </Card>
        </Section>

        <Section description="Who is actually predicting. Click through for the players." title="Player segments">
          <Card>
            <BarList
              rows={segments.map((s) => ({
                label: s.label,
                hint: s.description,
                value: s.count,
                href: `/host/analytics/players?segment=${s.key}`,
                display: (
                  <>
                    {s.count} <span className="text-ink-faint">· {pct(share(s.count, players.length))}</span>
                  </>
                ),
              }))}
            />
          </Card>
        </Section>

        <Section
          description={`Of the ${monthly.length} players seen in the last 30 days, how many days they came on.`}
          title="Return frequency"
        >
          <Card>
            <BarList
              rows={frequency.map((b) => ({
                label: b.label === "1 day" ? "Once" : `${b.label} days`,
                value: b.count,
                display: (
                  <>
                    {b.count} <span className="text-ink-faint">· {pct(share(b.count, monthly.length))}</span>
                  </>
                ),
              }))}
            />
          </Card>
        </Section>

        <Section
          description="Players who used each surface in the last 30 days. Many use more than one."
          title="Where they play"
        >
          <Card>
            <BarList
              max={Math.max(1, monthly.length)}
              rows={[
                { label: "Website", value: reach.web },
                { label: "iOS / Android app", value: reach.app },
                { label: "Bot API (incl. bots)", value: reach.api },
              ].map((r) => ({
                ...r,
                display: (
                  <>
                    {r.value}{" "}
                    {r.label.startsWith("Bot") ? null : (
                      <span className="text-ink-faint">· {pct(share(r.value, monthly.length))}</span>
                    )}
                  </>
                ),
              }))}
            />
          </Card>
        </Section>
      </div>

      <Section
        description="Players grouped by the week they signed up (Monday start). Each cell is the share of that week's sign-ups who came back in a later week."
        title="Weekly retention"
      >
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-xs">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 pr-3 text-left font-semibold">Signed up</th>
                <th className="px-2 py-1 text-right font-semibold">Players</th>
                {Array.from({ length: COHORTS }, (_, k) => (
                  <th className="px-1 py-1 text-center font-semibold" key={k}>
                    Wk {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...cohorts].reverse().map((c) => (
                <tr key={c.week}>
                  <td className="py-0.5 pr-3 text-ink-mid">w/c {formatDay(c.week)}</td>
                  <td className="px-2 py-0.5 text-right tabular-nums text-ink-mid">{c.size}</td>
                  {c.weeks.map((v, k) => (
                    <td className="p-[1px]" key={k}>
                      <div
                        className={`rounded-[3px] py-1.5 text-center tabular-nums ${v === null ? "" : heatText(v)}`}
                        style={heat(v)}
                        title={v === null ? undefined : `${pct(v)} of ${c.size} active in week ${k}`}
                      >
                        {v === null ? "" : pct(v)}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <HeatLegend high="100%" low="0%" />
        </Card>
      </Section>

      <Section
        description={`Share of players in a league on each competition who picked at least one fixture, by gameweek (last ${GAMEWEEKS}).`}
        title="Gameweek participation"
      >
        {gameweeks.length === 0 ? (
          <p className="text-sm text-ink-muted">No active competition has a league yet.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {gameweeks.map(({ competition, rounds }) => (
              <Card key={competition.id}>
                <h3 className="mb-3 text-sm font-semibold text-ink">
                  {competition.flag} {competition.name}
                </h3>
                {rounds.length === 0 ? (
                  <p className="text-sm text-ink-muted">No gameweek has kicked off yet.</p>
                ) : (
                  <>
                    <ColumnChart
                      columns={rounds.map((r) => ({
                        label: r.round.key,
                        value: Math.round((share(r.played, r.eligible) ?? 0) * 100),
                        axisLabel: r.round.label.replace(/^Matchday /i, "MD").replace(/^Gameweek /i, "GW"),
                        tooltip: `${r.round.label}: ${r.played} of ${r.eligible} players (${pct(share(r.played, r.eligible))}), ${r.picks} picks`,
                      }))}
                      format={(n) => `${n}%`}
                      height={120}
                      max={100}
                    />
                    <TableView
                      headers={["Gameweek", "Players", "Picked", "Share", "Picks"]}
                      rows={rounds.map((r) => [
                        r.round.label,
                        r.eligible,
                        r.played,
                        pct(share(r.played, r.eligible)),
                        r.picks,
                      ])}
                    />
                  </>
                )}
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        action={
          <Link className="text-sm text-pitch hover:underline" href="/host/analytics/leagues">
            All groups →
          </Link>
        }
        description="How big the groups are (human players) and the busiest ones right now."
        title="Groups"
      >
        <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
          <Card>
            <BarList
              rows={sizeBuckets.map((b) => ({
                label: b.label,
                value: b.count,
                href: b.label.startsWith("Solo")
                  ? "/host/analytics/leagues?size=solo"
                  : "/host/analytics/leagues?size=multi",
              }))}
            />
          </Card>
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Group</th>
                  <th className="px-3 py-2 text-right font-semibold">Players</th>
                  <th className="px-3 py-2 text-right font-semibold">Picking</th>
                  <th className="px-3 py-2 text-right font-semibold">Per GW</th>
                  <th className="px-4 py-2 font-semibold">Health</th>
                </tr>
              </thead>
              <tbody>
                {topGroups.map((l) => (
                  <tr className="border-b border-line-soft last:border-0" key={l.league.id}>
                    <td className="px-4 py-2">
                      <Link
                        className="font-medium text-ink hover:text-pitch hover:underline"
                        href={`/host/analytics/leagues/${l.league.id}`}
                      >
                        {l.league.name}
                      </Link>
                      <p className="text-xs text-ink-faint">{l.competition?.name}</p>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{l.humans}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{l.activePickers}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">{pct(l.participation)}</td>
                    <td className="px-4 py-2">
                      <HealthBadge health={l.health} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </Section>

      <Section
        description="Played at least 3 gameweeks, then missed the latest 2 or more in a row. Worth a nudge."
        title="Slipping away"
      >
        {slipping.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-ink-muted shadow-card">
            Nobody — every regular is still picking.
          </p>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Player</th>
                  <th className="px-3 py-2 text-right font-semibold">Gameweeks played</th>
                  <th className="px-3 py-2 text-right font-semibold">Missed in a row</th>
                  <th className="px-4 py-2 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {slipping.map((p) => (
                  <tr className="border-b border-line-soft last:border-0" key={p.user.id}>
                    <td className="px-4 py-2">
                      <Link
                        className="font-medium text-ink hover:text-pitch hover:underline"
                        href={`/host/analytics/players/${p.user.id}`}
                      >
                        {p.user.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.roundsPlayed}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.missStreak}</td>
                    <td className="px-4 py-2 text-ink-muted">{daysAgo(p.lastActiveDay, today)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </>
  )
}
