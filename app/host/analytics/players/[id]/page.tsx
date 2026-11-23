import Link from "next/link"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { ACTIVITY_TRACKING_STARTED, activityDayKey } from "@/lib/activity"
import {
  RECENT_ROUNDS,
  SEGMENTS,
  addDays,
  buildIndex,
  computePlayerStats,
  medianLeadHours,
  playerRounds,
  weekStart,
} from "@/lib/analytics/compute"
import { ACTIVITY_WINDOW_DAYS, loadAnalyticsDataset } from "@/lib/analytics/load"
import { avatarPath } from "@/lib/avatar"
import Avatar from "@/app/components/Avatar"
import {
  ActivityCalendar,
  BackLink,
  BarList,
  Card,
  ColumnChart,
  Section,
  SegmentBadge,
  StatTile,
  TableView,
  daysAgo,
  formatDate,
  formatDay,
  pct,
  share,
} from "../../ui"

export const metadata = { title: "Player · Analytics" }

const ROUNDS = 12
const CALENDAR_WEEKS = 26
const RECENT_PICKS = 15

function formatLead(hours: number | null): string {
  if (hours === null) return "—"
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} h`
  return `${(hours / 24).toFixed(1)} days`
}

export default async function AnalyticsPlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const account = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      _count: { select: { mobileDeviceTokens: true } },
    },
  })
  if (!account) notFound()

  const ds = await loadAnalyticsDataset({ userIds: [id] })
  const index = buildIndex(ds)
  const [p] = computePlayerStats(ds, index)
  const today = activityDayKey(ds.now)
  const segment = SEGMENTS.find((s) => s.key === p.segment)!

  const memberCounts = await prisma.leagueMembership.groupBy({
    by: ["leagueId"],
    where: { leagueId: { in: p.leagueIds } },
    _count: { _all: true },
  })
  const memberCount = new Map(memberCounts.map((m) => [m.leagueId, m._count._all]))
  const memberships = ds.memberships
    .map((m) => ({
      ...m,
      league: index.leagueById.get(m.leagueId),
    }))
    .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime())

  // Activity calendar: the last 26 weeks, Monday-start.
  const lastWeek = weekStart(today)
  const weeks = Array.from({ length: CALENDAR_WEEKS }, (_, i) => addDays(lastWeek, -7 * (CALENDAR_WEEKS - 1 - i)))
  const active = new Map(
    ds.activity.map((a) => [
      a.day,
      [a.web && "web", a.app && "app", a.api && "bot API"].filter(Boolean).join(" + ") || "active",
    ]),
  )
  const activeInWindow = ds.activity.filter((a) => a.day >= weeks[0]).length
  const surfaceDays = {
    web: ds.activity.filter((a) => a.web).length,
    app: ds.activity.filter((a) => a.app).length,
    api: ds.activity.filter((a) => a.api).length,
  }

  const rounds = playerRounds(ds, index, id, ROUNDS)
  const lead = medianLeadHours(ds, index, id)
  const viaWeb = ds.predictions.filter((x) => x.submittedVia === "WEB").length

  const recentPicks = ds.predictions
    .map((x) => ({ ...x, fixture: index.fixtureById.get(x.fixtureId) }))
    .filter((x) => x.fixture)
    .sort((a, b) => b.fixture!.kickoffTime.getTime() - a.fixture!.kickoffTime.getTime())
    .slice(0, RECENT_PICKS)

  return (
    <>
      <BackLink href="/host/analytics/players">All players</BackLink>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Avatar
          avatarUrl={avatarPath(p.user.avatarKey)}
          displayName={p.user.displayName}
          size="md"
          userId={p.user.id}
        />
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-bold text-ink">
            {p.user.displayName}
            <SegmentBadge segment={p.segment} />
            {p.user.isBot ? <span className="text-xs font-normal text-ink-muted">bot</span> : null}
            {p.user.isSiteAdmin ? <span className="text-xs font-normal text-ink-muted">host</span> : null}
          </h2>
          <p className="text-sm text-ink-muted">
            {p.user.email} · joined {formatDate(p.user.createdAt)} ·{" "}
            {p.user.emailVerifiedAt ? "verified" : "unverified"}
            {account._count.mobileDeviceTokens > 0 ? " · app installed" : ""} ·{" "}
            <Link className="text-pitch hover:underline" href={`/host/users?q=${encodeURIComponent(p.user.email)}`}>
              account actions
            </Link>
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">{segment.description}.</p>
        </div>
      </div>

      <Section title="At a glance">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            hint={`${pct(p.fixtureCoverage)} of kicked-off fixtures since joining`}
            label="Picks"
            value={p.picks}
          />
          <StatTile
            hint={
              p.missStreak > 0
                ? `Missed the latest ${p.missStreak} in a row`
                : p.roundsPlayed > 0
                  ? "Played the latest one"
                  : "None yet"
            }
            label="Gameweeks played"
            value={
              <>
                {p.roundsPlayed}
                <span className="text-base font-semibold text-ink-faint"> / {p.roundsEligible}</span>
              </>
            }
          />
          <StatTile
            hint={`Picked in ${p.recentPlayed} of the last ${p.recentEligible} they could`}
            label={`Last ${RECENT_ROUNDS} gameweeks`}
            value={pct(share(p.recentPlayed, p.recentEligible))}
          />
          <StatTile
            hint={`Last seen ${daysAgo(p.lastActiveDay, today).toLowerCase()}`}
            label="Active days · 30d"
            value={p.activeDays30}
          />
          <StatTile
            hint={`${p.exact} exact · ${p.correctResult} right result, of ${p.settled} settled`}
            label="Exact scores"
            value={pct(share(p.exact, p.settled))}
          />
          <StatTile
            hint="Right result, any score"
            label="Results called"
            value={pct(share(p.correctResult, p.settled))}
          />
          <StatTile
            hint={`${p.points} points from ${p.settled} settled picks (bankers included, streaks not)`}
            label="Points per pick"
            value={p.settled > 0 ? (p.points / p.settled).toFixed(2) : "—"}
          />
          <StatTile
            hint={`Median time between first pick and kickoff · ${p.bankers} banker${p.bankers === 1 ? "" : "s"} played`}
            label="Picks ahead"
            value={formatLead(lead)}
          />
        </div>
      </Section>

      <Section
        description={
          <>
            Days on which they used Scorers over the last {CALENDAR_WEEKS} weeks ({activeInWindow} days).
            Before {formatDay(ACTIVITY_TRACKING_STARTED, true)} only days with a pick, sign-up or league
            join are known.
          </>
        }
        title="Activity"
      >
        <Card>
          <ActivityCalendar
            active={active}
            firstTracked={addDays(today, -(ACTIVITY_WINDOW_DAYS - 1))}
            today={today}
            weeks={weeks}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Days by surface</h3>
              <BarList
                rows={[
                  { label: "Website", value: surfaceDays.web },
                  { label: "App", value: surfaceDays.app },
                  { label: "Bot API", value: surfaceDays.api },
                ]}
              />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Picks submitted via</h3>
              <BarList
                rows={[
                  { label: "Website", value: viaWeb },
                  { label: "App or bot API", value: ds.predictions.length - viaWeb },
                ]}
              />
            </div>
          </div>
        </Card>
      </Section>

      <Section
        description={`Fixtures picked in each of their last ${ROUNDS} gameweeks, across all their groups' competitions.`}
        title="Gameweek by gameweek"
      >
        <Card>
          {rounds.length === 0 ? (
            <p className="text-sm text-ink-muted">No gameweek has kicked off since they joined a group.</p>
          ) : (
            <>
              <ColumnChart
                columns={rounds.map((r) => ({
                  label: r.round.key,
                  value: r.picks,
                  axisLabel: r.round.label.replace(/^Matchday /i, "MD").replace(/^Gameweek /i, "GW"),
                  tooltip: `${r.competition?.name ?? ""} ${r.round.label}: ${r.picks} of ${r.fixtures} picked${
                    r.points !== null ? `, ${r.points} pts` : ""
                  }${r.banker ? " ★" : ""}`,
                }))}
                height={110}
                max={Math.max(1, ...rounds.map((r) => r.fixtures))}
              />
              <TableView
                headers={["Gameweek", "Fixtures", "Picked", "Points", "Banker"]}
                rows={rounds.map((r) => [
                  `${r.competition?.name ?? ""} · ${r.round.label}`,
                  r.fixtures,
                  r.picks,
                  r.points ?? "—",
                  r.banker ? "★" : "",
                ])}
              />
            </>
          )}
        </Card>
      </Section>

      <Section title="Groups">
        {memberships.length === 0 ? (
          <p className="text-sm text-ink-muted">Not in any group.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Group</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 text-right font-semibold">Members</th>
                  <th className="px-4 py-2 font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {memberships.map((m) => (
                  <tr className="border-b border-line-soft last:border-0" key={m.leagueId}>
                    <td className="px-4 py-2">
                      <Link
                        className="font-medium text-ink hover:text-pitch hover:underline"
                        href={`/host/analytics/leagues/${m.leagueId}`}
                      >
                        {m.league?.name}
                      </Link>
                      <p className="text-xs text-ink-faint">
                        {index.competitionById.get(m.league?.competitionId ?? "")?.name}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-ink-muted">
                      {m.role === "COMMISSIONER" ? "Commissioner" : "Member"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{memberCount.get(m.leagueId) ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-muted">{formatDate(m.joinedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Recent picks">
        {recentPicks.length === 0 ? (
          <p className="text-sm text-ink-muted">No picks yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-card">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead className="border-b border-line bg-chip text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2 font-semibold">Fixture</th>
                  <th className="px-3 py-2 text-center font-semibold">Pick</th>
                  <th className="px-3 py-2 text-center font-semibold">Result</th>
                  <th className="px-3 py-2 text-right font-semibold">Pts</th>
                  <th className="px-3 py-2 font-semibold">Picked</th>
                  <th className="px-4 py-2 font-semibold">Via</th>
                </tr>
              </thead>
              <tbody>
                {recentPicks.map((x) => {
                  const f = x.fixture!
                  const hours = (f.kickoffTime.getTime() - x.createdAt.getTime()) / 3_600_000
                  return (
                    <tr className="border-b border-line-soft last:border-0" key={x.fixtureId}>
                      <td className="px-4 py-2">
                        <span className="text-ink">
                          {f.homeTeam} v {f.awayTeam}
                        </span>
                        <p className="text-xs text-ink-faint">
                          {index.competitionById.get(f.competitionId)?.name} · {f.round} ·{" "}
                          {formatDate(f.kickoffTime)}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-center score-digits text-ink">
                        {x.predictedHomeScore}–{x.predictedAwayScore}
                        {x.isBanker ? <span className="ml-1 text-clock" title="Banker">★</span> : null}
                      </td>
                      <td className="px-3 py-2 text-center score-digits text-ink-mid">
                        {f.actualHomeScore !== null ? `${f.actualHomeScore}–${f.actualAwayScore}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">{x.pointsAwarded ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-muted">
                        {hours >= 0 ? `${formatLead(hours)} before` : "after kickoff"}
                      </td>
                      <td className="px-4 py-2 text-ink-muted">{x.submittedVia === "WEB" ? "Web" : "App/API"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  )
}
