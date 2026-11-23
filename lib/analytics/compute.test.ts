import { describe, it, expect } from "vitest"
import {
  addDays,
  buildIndex,
  buildRounds,
  computeLeagueStats,
  computePlayerStats,
  dailyActive,
  engagementFunnel,
  leagueHealth,
  medianLeadHours,
  playerRounds,
  returnFrequency,
  segmentFor,
  stickiness,
  weekOverWeekReturn,
  weekStart,
  weeklyRetention,
  competitionRoundStats,
  leagueMemberStats,
  type AFixture,
  type AnalyticsDataset,
  type APrediction,
  type AUser,
} from "./compute"

// Monday 23 Nov 2026, midday UTC (= London).
const NOW = new Date("2026-11-23T12:00:00Z")
const day = (offset: number) => new Date(NOW.getTime() + offset * 24 * 60 * 60 * 1000)

function user(id: string, extra: Partial<AUser> = {}): AUser {
  return {
    id,
    displayName: id.toUpperCase(),
    email: `${id}@test`,
    isBot: false,
    isSiteAdmin: false,
    createdAt: day(-60),
    emailVerifiedAt: day(-60),
    lastSeenAt: null,
    avatarKey: null,
    ...extra,
  }
}

/** Kickoff of fixture `i` in gameweek `gw`: GW1 kicked off ~5 weeks ago, GW6 starts in 12 hours. */
const kick = (gw: number, i: number) => day(-42 + gw * 7 + i + 0.5)

/** Six weekly rounds GW1..GW6 of two fixtures each. */
function fixtures(competitionId = "pl"): AFixture[] {
  const out: AFixture[] = []
  for (let gw = 1; gw <= 6; gw++) {
    for (let i = 0; i < 2; i++) {
      const kickoff = kick(gw, i)
      const done = kickoff < NOW
      out.push({
        id: `${competitionId}-gw${gw}-${i}`,
        competitionId,
        round: `GW${gw}`,
        homeTeam: "A",
        awayTeam: "B",
        kickoffTime: kickoff,
        actualHomeScore: done ? 2 : null,
        actualAwayScore: done ? 1 : null,
      })
    }
  }
  return out
}

function pick(userId: string, fixtureId: string, extra: Partial<APrediction> = {}): APrediction {
  return {
    userId,
    fixtureId,
    predictedHomeScore: 2,
    predictedAwayScore: 1,
    isBanker: false,
    pointsAwarded: 3,
    submittedVia: "WEB",
    createdAt: day(-50),
    ...extra,
  }
}

function dataset(extra: Partial<AnalyticsDataset> = {}): AnalyticsDataset {
  return {
    now: NOW,
    users: [],
    competitions: [{ id: "pl", name: "Premier League", flag: "", archivedAt: null }],
    leagues: [{ id: "l1", name: "Friends", competitionId: "pl", createdAt: day(-60) }],
    memberships: [],
    fixtures: fixtures(),
    predictions: [],
    activity: [],
    activitySince: addDays("2026-11-23", -100),
    ...extra,
  }
}

describe("day helpers", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-23")).toBe("2026-11-23") // a Monday
    expect(weekStart("2026-11-29")).toBe("2026-11-23") // Sunday
    expect(weekStart("2026-11-22")).toBe("2026-11-16")
  })
})

describe("buildRounds", () => {
  it("groups fixtures into rounds ordered by first kickoff and flags started ones", () => {
    const rounds = buildRounds(fixtures(), NOW).get("pl")!
    expect(rounds.map((r) => r.label)).toEqual(["GW1", "GW2", "GW3", "GW4", "GW5", "GW6"])
    expect(rounds.map((r) => r.started)).toEqual([true, true, true, true, true, false])
    expect(rounds[0].fixtureIds).toHaveLength(2)
  })
})

describe("segmentFor", () => {
  const base = { leagueCount: 1, hasActiveCompetition: true, picks: 5, recentEligible: 4 }
  it("ranks by the share of recent gameweeks played", () => {
    expect(segmentFor({ ...base, recentPlayed: 4 })).toBe("core")
    expect(segmentFor({ ...base, recentPlayed: 3 })).toBe("core")
    expect(segmentFor({ ...base, recentPlayed: 2 })).toBe("regular")
    expect(segmentFor({ ...base, recentPlayed: 1 })).toBe("casual")
    expect(segmentFor({ ...base, recentPlayed: 0 })).toBe("lapsed")
    expect(segmentFor({ ...base, picks: 0, recentPlayed: 0 })).toBe("never")
  })
  it("separates the leagueless and those yet to get a gameweek", () => {
    expect(segmentFor({ ...base, leagueCount: 0, recentPlayed: 0 })).toBe("no-league")
    expect(segmentFor({ ...base, recentEligible: 0, recentPlayed: 0 })).toBe("new")
    // Only in a finished competition: nothing to start, so not "new".
    expect(
      segmentFor({ ...base, hasActiveCompetition: false, recentEligible: 0, recentPlayed: 0 }),
    ).toBe("lapsed")
  })
})

describe("computePlayerStats", () => {
  const ds = dataset({
    users: [
      user("core"),
      user("lapsed"),
      user("late", { createdAt: day(-1) }),
      user("lonely"),
      user("ghost"),
    ],
    memberships: [
      { userId: "core", leagueId: "l1", role: "COMMISSIONER", joinedAt: day(-60) },
      { userId: "lapsed", leagueId: "l1", role: "MEMBER", joinedAt: day(-60) },
      // Joined after GW5 kicked off: only GW6 (not started) is left.
      { userId: "late", leagueId: "l1", role: "MEMBER", joinedAt: day(-1) },
      { userId: "ghost", leagueId: "l1", role: "MEMBER", joinedAt: day(-60) },
    ],
    predictions: [
      // core: GW2-GW5 (one fixture each) plus GW6 upcoming.
      ...[2, 3, 4, 5].map((gw) => pick("core", `pl-gw${gw}-0`)),
      pick("core", "pl-gw6-0", { pointsAwarded: null }),
      pick("core", "pl-gw5-1", { predictedHomeScore: 0, predictedAwayScore: 1, pointsAwarded: 0 }),
      // lapsed: GW1 only.
      pick("lapsed", "pl-gw1-0", { isBanker: true, pointsAwarded: 6 }),
    ],
    activity: [
      { userId: "core", day: "2026-11-23", web: true, app: false, api: false },
      { userId: "core", day: "2026-11-20", web: false, app: true, api: false },
      { userId: "core", day: "2026-10-01", web: true, app: false, api: false },
    ],
  })
  const stats = new Map(computePlayerStats(ds).map((s) => [s.user.id, s]))

  it("measures recent gameweeks, coverage and the miss streak", () => {
    const core = stats.get("core")!
    expect(core.segment).toBe("core")
    expect(core.recentEligible).toBe(4) // GW2-GW5
    expect(core.recentPlayed).toBe(4)
    expect(core.roundsEligible).toBe(5)
    expect(core.roundsPlayed).toBe(4)
    expect(core.missStreak).toBe(0)
    // 5 kicked-off picks out of 10 kicked-off fixtures.
    expect(core.fixtureCoverage).toBe(0.5)

    const lapsed = stats.get("lapsed")!
    expect(lapsed.segment).toBe("lapsed")
    expect(lapsed.missStreak).toBe(4)
    expect(lapsed.bankers).toBe(1)
  })

  it("scores accuracy from settled picks only", () => {
    const core = stats.get("core")!
    expect(core.picks).toBe(6)
    expect(core.settled).toBe(5)
    expect(core.exact).toBe(4)
    expect(core.correctResult).toBe(4)
    expect(core.points).toBe(12)
  })

  it("counts active days and surfaces", () => {
    const core = stats.get("core")!
    expect(core.activeDays7).toBe(2)
    expect(core.activeDays30).toBe(2)
    expect(core.lastActiveDay).toBe("2026-11-23")
    expect(core.surfaces30).toEqual({ web: true, app: true, api: false })
  })

  it("segments the rest", () => {
    expect(stats.get("late")!.segment).toBe("new")
    expect(stats.get("lonely")!.segment).toBe("no-league")
    expect(stats.get("ghost")!.segment).toBe("never")
    expect(stats.get("ghost")!.fixtureCoverage).toBe(0)
  })

  it("builds the funnel", () => {
    const funnel = engagementFunnel([...stats.values()])
    expect(funnel.map((s) => s.count)).toEqual([5, 5, 4, 2, 1, 1])
  })
})

describe("leagueHealth", () => {
  it("labels by participation", () => {
    expect(leagueHealth({ archived: true, humans: 5, participation: 1 })).toBe("finished")
    expect(leagueHealth({ archived: false, humans: 1, participation: 1 })).toBe("solo")
    expect(leagueHealth({ archived: false, humans: 4, participation: 0.8 })).toBe("thriving")
    expect(leagueHealth({ archived: false, humans: 4, participation: 0.4 })).toBe("active")
    expect(leagueHealth({ archived: false, humans: 4, participation: 0.1 })).toBe("quiet")
    expect(leagueHealth({ archived: false, humans: 4, participation: 0 })).toBe("dormant")
  })
})

describe("computeLeagueStats", () => {
  it("averages each recent round's share of eligible members who picked", () => {
    const ds = dataset({
      users: [user("a"), user("b"), user("bot", { isBot: true })],
      memberships: [
        { userId: "a", leagueId: "l1", role: "COMMISSIONER", joinedAt: day(-60) },
        { userId: "b", leagueId: "l1", role: "MEMBER", joinedAt: day(-60) },
        { userId: "bot", leagueId: "l1", role: "MEMBER", joinedAt: day(-60) },
      ],
      predictions: [
        ...[2, 3, 4, 5].map((gw) => pick("a", `pl-gw${gw}-0`)),
        ...[2, 3, 4, 5].flatMap((gw) => [pick("bot", `pl-gw${gw}-0`), pick("bot", `pl-gw${gw}-1`)]),
        pick("b", "pl-gw5-0"),
      ],
    })
    const [l1] = computeLeagueStats(ds)
    expect(l1.members).toBe(3)
    expect(l1.humans).toBe(2)
    expect(l1.bots).toBe(1)
    expect(l1.commissioners).toEqual(["A"])
    expect(l1.activePickers).toBe(3)
    // GW2-GW4: 2/3 each; GW5: 3/3.
    expect(l1.participation).toBeCloseTo((2 / 3) * 0.75 + 0.25)
    expect(l1.health).toBe("thriving")
    expect(l1.picks).toBe(13)
    expect(l1.recentRounds.map((r) => r.played)).toEqual([2, 2, 2, 3])
    // GW5: 4 picks out of 3 members × 2 fixtures.
    expect(l1.recentRounds[3].fixtureCoverage).toBeCloseTo(4 / 6)

    const members = new Map(leagueMemberStats(ds, buildIndex(ds), "l1").map((m) => [m.membership.userId, m]))
    expect(members.get("a")).toMatchObject({ picks: 4, roundsEligible: 5, roundsPlayed: 4, recentPlayed: 4 })
    expect(members.get("b")).toMatchObject({ picks: 1, roundsPlayed: 1, recentEligible: 4, recentPlayed: 1 })
    expect(members.get("b")!.user?.displayName).toBe("B")
  })
})

describe("activity metrics", () => {
  const ds = dataset({
    users: [user("a"), user("b"), user("c")],
    activity: [
      { userId: "a", day: "2026-11-10", web: true, app: false, api: false },
      { userId: "a", day: "2026-11-22", web: true, app: false, api: false },
      { userId: "a", day: "2026-11-23", web: true, app: false, api: false },
      { userId: "b", day: "2026-11-12", web: true, app: false, api: false },
      { userId: "c", day: "2026-11-23", web: false, app: true, api: false },
    ],
  })
  const all = () => true

  it("splits daily actives into first visits and returning users", () => {
    const days = dailyActive(ds, 3, all)
    expect(days).toEqual([
      { day: "2026-11-21", returning: 0, firstVisit: 0 },
      { day: "2026-11-22", returning: 1, firstVisit: 0 },
      { day: "2026-11-23", returning: 1, firstVisit: 1 },
    ])
  })

  it("measures week-over-week return", () => {
    // Active 8–14 days ago: a (10th), b (12th). Back this week: a.
    expect(weekOverWeekReturn(ds, all)).toEqual({ previous: 2, returned: 1, rate: 0.5 })
  })

  it("computes stickiness as mean DAU/MAU", () => {
    // Today: 2 active of 3 in the trailing 30 days.
    expect(stickiness(ds, 1, all)).toBeCloseTo(2 / 3)
  })

  it("buckets active days", () => {
    const players = computePlayerStats(ds)
    expect(returnFrequency(players).map((b) => b.count)).toEqual([2, 1, 0, 0, 0])
  })
})

describe("weeklyRetention", () => {
  it("tracks each sign-up week's share active in later weeks", () => {
    const ds = dataset({
      users: [
        user("a", { createdAt: new Date("2026-11-10T10:00:00Z") }),
        user("b", { createdAt: new Date("2026-11-11T10:00:00Z") }),
        user("c", { createdAt: new Date("2026-11-17T10:00:00Z") }),
      ],
      activity: [
        { userId: "a", day: "2026-11-10", web: true, app: false, api: false },
        { userId: "b", day: "2026-11-11", web: true, app: false, api: false },
        { userId: "a", day: "2026-11-18", web: true, app: false, api: false },
        { userId: "c", day: "2026-11-17", web: true, app: false, api: false },
      ],
    })
    const cohorts = weeklyRetention(ds, 3, () => true)
    expect(cohorts.map((c) => [c.week, c.size])).toEqual([
      ["2026-11-09", 2],
      ["2026-11-16", 1],
      ["2026-11-23", 0],
    ])
    expect(cohorts[0].weeks).toEqual([1, 0.5, 0])
    expect(cohorts[1].weeks).toEqual([1, 0, null])
    expect(cohorts[2].weeks).toEqual([null, null, null])
  })
})

describe("player drill-down helpers", () => {
  const ds = dataset({
    users: [user("a")],
    memberships: [{ userId: "a", leagueId: "l1", role: "MEMBER", joinedAt: day(-60) }],
    predictions: [
      pick("a", "pl-gw4-0", { createdAt: new Date(kick(4, 0).getTime() - 2 * 3600_000), isBanker: true, pointsAwarded: 6 }),
      pick("a", "pl-gw5-0", { createdAt: new Date(kick(5, 0).getTime() - 10 * 3600_000) }),
      pick("a", "pl-gw5-1", { createdAt: new Date(kick(5, 1).getTime() - 30 * 3600_000), pointsAwarded: 0 }),
    ],
  })
  const index = buildIndex(ds)

  it("lists recent eligible rounds with picks and points", () => {
    const rounds = playerRounds(ds, index, "a", 3)
    expect(rounds.map((r) => [r.round.label, r.picks, r.points, r.banker])).toEqual([
      ["GW3", 0, null, false],
      ["GW4", 1, 6, true],
      ["GW5", 2, 3, false],
    ])
  })

  it("takes the median lead time", () => {
    expect(medianLeadHours(ds, index, "a")).toBe(10)
  })

  it("reports per-round participation for a competition", () => {
    const rows = competitionRoundStats(ds, index, "pl", 2, () => true)
    expect(rows.map((r) => [r.round.label, r.eligible, r.played, r.picks])).toEqual([
      ["GW4", 1, 1, 1],
      ["GW5", 1, 1, 2],
    ])
  })
})
