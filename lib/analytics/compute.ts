/**
 * Pure analytics over a lean snapshot of the database (see `load.ts`). Nothing
 * here touches Prisma, so every number on /host/analytics is unit-testable.
 *
 * Vocabulary:
 * - A **round** is a gameweek: (competition, round label). It has **started**
 *   once its first fixture has kicked off.
 * - A player is **eligible** for a round if they were in a league on that
 *   competition before one of the round's fixtures kicked off.
 * - A player **played** a round if they picked at least one of its fixtures.
 * - **Recent rounds** are the last `RECENT_ROUNDS` started rounds of each
 *   competition that isn't finished (archived).
 * - Days are Europe/London calendar days, as `YYYY-MM-DD` keys.
 */
import { scoreOnePrediction } from "@/lib/scoring"
import { activityDayKey } from "@/lib/activity"

export const RECENT_ROUNDS = 4
const DAY_MS = 24 * 60 * 60 * 1000

// ── Snapshot types ─────────────────────────────────────────────────────────

export type AUser = {
  id: string
  displayName: string
  email: string
  isBot: boolean
  isSiteAdmin: boolean
  createdAt: Date
  emailVerifiedAt: Date | null
  lastSeenAt: Date | null
  avatarKey: string | null
}
export type ACompetition = { id: string; name: string; flag: string; archivedAt: Date | null }
export type ALeague = { id: string; name: string; competitionId: string; createdAt: Date }
export type AMembership = { userId: string; leagueId: string; role: string; joinedAt: Date }
export type AFixture = {
  id: string
  competitionId: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: Date
  actualHomeScore: number | null
  actualAwayScore: number | null
}
export type APrediction = {
  userId: string
  fixtureId: string
  predictedHomeScore: number
  predictedAwayScore: number
  isBanker: boolean
  pointsAwarded: number | null
  submittedVia: "WEB" | "API" | "APP"
  createdAt: Date
}
export type AActivityDay = { userId: string; day: string; web: boolean; app: boolean; api: boolean }

export type AnalyticsDataset = {
  now: Date
  users: AUser[]
  competitions: ACompetition[]
  leagues: ALeague[]
  memberships: AMembership[]
  fixtures: AFixture[]
  predictions: APrediction[]
  /** Activity days inside the loaded window (see `activitySince`). */
  activity: AActivityDay[]
  /** First day covered by `activity`. Days before it are unknown, not inactive. */
  activitySince: string
}

// ── Day helpers ────────────────────────────────────────────────────────────

/** `YYYY-MM-DD` → UTC-midnight Date (pure date arithmetic, no DST surprises). */
function dayToDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`)
}

export function addDays(day: string, n: number): string {
  return new Date(dayToDate(day).getTime() + n * DAY_MS).toISOString().slice(0, 10)
}

/** The Monday on or before `day`. */
export function weekStart(day: string): string {
  const dow = dayToDate(day).getUTCDay() // 0 = Sunday
  return addDays(day, -((dow + 6) % 7))
}

/** Inclusive list of day keys, oldest first. */
export function dayRange(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dayToDate(to).getTime() - dayToDate(from).getTime()) / DAY_MS)
}

// ── Rounds ─────────────────────────────────────────────────────────────────

export type Round = {
  key: string
  competitionId: string
  label: string
  firstKickoff: Date
  lastKickoff: Date
  fixtureIds: string[]
  started: boolean
}

export function roundKey(competitionId: string, label: string): string {
  return `${competitionId}::${label}`
}

/** Every round, per competition, ordered by first kickoff. */
export function buildRounds(fixtures: AFixture[], now: Date): Map<string, Round[]> {
  const byKey = new Map<string, Round>()
  for (const f of fixtures) {
    const key = roundKey(f.competitionId, f.round)
    const r = byKey.get(key)
    if (!r) {
      byKey.set(key, {
        key,
        competitionId: f.competitionId,
        label: f.round,
        firstKickoff: f.kickoffTime,
        lastKickoff: f.kickoffTime,
        fixtureIds: [f.id],
        started: false,
      })
    } else {
      r.fixtureIds.push(f.id)
      if (f.kickoffTime < r.firstKickoff) r.firstKickoff = f.kickoffTime
      if (f.kickoffTime > r.lastKickoff) r.lastKickoff = f.kickoffTime
    }
  }
  const byCompetition = new Map<string, Round[]>()
  for (const r of byKey.values()) {
    r.started = r.firstKickoff <= now
    const list = byCompetition.get(r.competitionId) ?? []
    list.push(r)
    byCompetition.set(r.competitionId, list)
  }
  for (const list of byCompetition.values()) {
    list.sort((a, b) => a.firstKickoff.getTime() - b.firstKickoff.getTime())
  }
  return byCompetition
}

/** The last `n` started rounds of a competition, oldest first. */
export function recentStartedRounds(rounds: Round[] | undefined, n = RECENT_ROUNDS): Round[] {
  return (rounds ?? []).filter((r) => r.started).slice(-n)
}

// ── Shared indexes ─────────────────────────────────────────────────────────

type Index = {
  rounds: Map<string, Round[]>
  fixtureById: Map<string, AFixture>
  leagueById: Map<string, ALeague>
  competitionById: Map<string, ACompetition>
  /** userId → competitionId → earliest join to a league on that competition. */
  joinedCompetition: Map<string, Map<string, Date>>
  membershipsByUser: Map<string, AMembership[]>
  membershipsByLeague: Map<string, AMembership[]>
  predictionsByUser: Map<string, APrediction[]>
  /** userId → set of round keys with at least one pick. */
  playedRounds: Map<string, Set<string>>
  activityByUser: Map<string, AActivityDay[]>
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

export function buildIndex(ds: AnalyticsDataset): Index {
  const rounds = buildRounds(ds.fixtures, ds.now)
  const fixtureById = new Map(ds.fixtures.map((f) => [f.id, f]))
  const leagueById = new Map(ds.leagues.map((l) => [l.id, l]))
  const competitionById = new Map(ds.competitions.map((c) => [c.id, c]))

  const joinedCompetition = new Map<string, Map<string, Date>>()
  const membershipsByUser = new Map<string, AMembership[]>()
  const membershipsByLeague = new Map<string, AMembership[]>()
  for (const m of ds.memberships) {
    push(membershipsByUser, m.userId, m)
    push(membershipsByLeague, m.leagueId, m)
    const league = leagueById.get(m.leagueId)
    if (!league) continue
    const perUser = joinedCompetition.get(m.userId) ?? new Map<string, Date>()
    const prev = perUser.get(league.competitionId)
    if (!prev || m.joinedAt < prev) perUser.set(league.competitionId, m.joinedAt)
    joinedCompetition.set(m.userId, perUser)
  }

  const predictionsByUser = new Map<string, APrediction[]>()
  const playedRounds = new Map<string, Set<string>>()
  for (const p of ds.predictions) {
    push(predictionsByUser, p.userId, p)
    const f = fixtureById.get(p.fixtureId)
    if (!f) continue
    const set = playedRounds.get(p.userId) ?? new Set<string>()
    set.add(roundKey(f.competitionId, f.round))
    playedRounds.set(p.userId, set)
  }

  const activityByUser = new Map<string, AActivityDay[]>()
  for (const a of ds.activity) push(activityByUser, a.userId, a)

  return {
    rounds,
    fixtureById,
    leagueById,
    competitionById,
    joinedCompetition,
    membershipsByUser,
    membershipsByLeague,
    predictionsByUser,
    playedRounds,
    activityByUser,
  }
}

/** Whether someone who joined at `joinedAt` could still pick in `round`. */
function eligible(round: Round, joinedAt: Date | undefined): boolean {
  return !!joinedAt && round.started && round.lastKickoff > joinedAt
}

// ── Players ────────────────────────────────────────────────────────────────

export type Segment = "core" | "regular" | "casual" | "lapsed" | "never" | "new" | "no-league"

export const SEGMENTS: Array<{ key: Segment; label: string; description: string }> = [
  { key: "core", label: "Core", description: `Picked in 3+ of their last ${RECENT_ROUNDS} gameweeks` },
  { key: "regular", label: "Regular", description: `Picked in 2 of their last ${RECENT_ROUNDS} gameweeks` },
  { key: "casual", label: "Casual", description: `Picked in 1 of their last ${RECENT_ROUNDS} gameweeks` },
  { key: "lapsed", label: "Lapsed", description: "Has picked before, but none recently" },
  { key: "never", label: "Never picked", description: "Had gameweeks to play, never made a pick" },
  { key: "new", label: "Not started", description: "No gameweek has kicked off since they joined" },
  { key: "no-league", label: "No league", description: "Signed up but never joined a league" },
]

export function segmentFor(input: {
  leagueCount: number
  hasActiveCompetition: boolean
  picks: number
  recentEligible: number
  recentPlayed: number
}): Segment {
  if (input.leagueCount === 0) return "no-league"
  if (input.recentEligible === 0) {
    if (input.hasActiveCompetition) return "new"
    return input.picks > 0 ? "lapsed" : "never"
  }
  if (input.recentPlayed === 0) return input.picks > 0 ? "lapsed" : "never"
  const ratio = input.recentPlayed / input.recentEligible
  if (ratio >= 0.75) return "core"
  if (ratio >= 0.4) return "regular"
  return "casual"
}

export type PlayerStats = {
  user: AUser
  leagueIds: string[]
  leagueCount: number
  picks: number
  /** Picks on fixtures that have kicked off / fixtures they could have picked. */
  fixtureCoverage: number | null
  roundsEligible: number
  roundsPlayed: number
  recentEligible: number
  recentPlayed: number
  /** Most recent eligible rounds missed in a row (0 = played the latest one). */
  missStreak: number
  firstPickAt: Date | null
  lastPickAt: Date | null
  settled: number
  points: number
  exact: number
  correctResult: number
  bankers: number
  activeDays7: number
  activeDays30: number
  lastActiveDay: string | null
  surfaces30: { web: boolean; app: boolean; api: boolean }
  segment: Segment
}

export function computePlayerStats(ds: AnalyticsDataset, index = buildIndex(ds)): PlayerStats[] {
  const today = activityDayKey(ds.now)
  const day7 = addDays(today, -6)
  const day30 = addDays(today, -29)

  return ds.users.map((user) => {
    const memberships = index.membershipsByUser.get(user.id) ?? []
    const joined = index.joinedCompetition.get(user.id) ?? new Map<string, Date>()
    const played = index.playedRounds.get(user.id) ?? new Set<string>()
    const predictions = index.predictionsByUser.get(user.id) ?? []

    let roundsEligible = 0
    let roundsPlayed = 0
    let recentEligible = 0
    let recentPlayed = 0
    let eligibleFixtures = 0
    let hasActiveCompetition = false
    // Every eligible round across competitions, for the miss streak.
    const eligibleRounds: Round[] = []

    for (const [competitionId, joinedAt] of joined) {
      const competition = index.competitionById.get(competitionId)
      const active = !!competition && !competition.archivedAt
      if (active) hasActiveCompetition = true
      const rounds = index.rounds.get(competitionId) ?? []
      const recent = new Set(active ? recentStartedRounds(rounds).map((r) => r.key) : [])
      for (const r of rounds) {
        if (!eligible(r, joinedAt)) continue
        eligibleRounds.push(r)
        roundsEligible++
        const didPlay = played.has(r.key)
        if (didPlay) roundsPlayed++
        if (recent.has(r.key)) {
          recentEligible++
          if (didPlay) recentPlayed++
        }
        for (const fid of r.fixtureIds) {
          const f = index.fixtureById.get(fid)
          if (f && f.kickoffTime <= ds.now && f.kickoffTime > joinedAt) eligibleFixtures++
        }
      }
    }

    eligibleRounds.sort((a, b) => b.firstKickoff.getTime() - a.firstKickoff.getTime())
    let missStreak = 0
    for (const r of eligibleRounds) {
      if (played.has(r.key)) break
      missStreak++
    }

    let settled = 0
    let points = 0
    let exact = 0
    let correctResult = 0
    let bankers = 0
    let kickedOffPicks = 0
    let firstPickAt: Date | null = null
    let lastPickAt: Date | null = null
    for (const p of predictions) {
      if (!firstPickAt || p.createdAt < firstPickAt) firstPickAt = p.createdAt
      if (!lastPickAt || p.createdAt > lastPickAt) lastPickAt = p.createdAt
      if (p.isBanker) bankers++
      const f = index.fixtureById.get(p.fixtureId)
      if (f && f.kickoffTime <= ds.now) kickedOffPicks++
      if (p.pointsAwarded !== null && f && f.actualHomeScore !== null && f.actualAwayScore !== null) {
        settled++
        points += p.pointsAwarded
        const base = scoreOnePrediction(
          p.predictedHomeScore,
          p.predictedAwayScore,
          f.actualHomeScore,
          f.actualAwayScore,
        )
        if (base === 3) exact++
        if (base > 0) correctResult++
      }
    }

    const activity = index.activityByUser.get(user.id) ?? []
    let activeDays7 = 0
    let activeDays30 = 0
    let lastActiveDay: string | null = null
    const surfaces30 = { web: false, app: false, api: false }
    for (const a of activity) {
      if (!lastActiveDay || a.day > lastActiveDay) lastActiveDay = a.day
      if (a.day >= day7) activeDays7++
      if (a.day >= day30) {
        activeDays30++
        surfaces30.web ||= a.web
        surfaces30.app ||= a.app
        surfaces30.api ||= a.api
      }
    }

    return {
      user,
      leagueIds: memberships.map((m) => m.leagueId),
      leagueCount: memberships.length,
      picks: predictions.length,
      fixtureCoverage: eligibleFixtures > 0 ? Math.min(1, kickedOffPicks / eligibleFixtures) : null,
      roundsEligible,
      roundsPlayed,
      recentEligible,
      recentPlayed,
      missStreak,
      firstPickAt,
      lastPickAt,
      settled,
      points,
      exact,
      correctResult,
      bankers,
      activeDays7,
      activeDays30,
      lastActiveDay,
      surfaces30,
      segment: segmentFor({
        leagueCount: memberships.length,
        hasActiveCompetition,
        picks: predictions.length,
        recentEligible,
        recentPlayed,
      }),
    }
  })
}

// ── Leagues ────────────────────────────────────────────────────────────────

export type LeagueHealth = "thriving" | "active" | "quiet" | "dormant" | "solo" | "finished"

export const LEAGUE_HEALTH: Record<LeagueHealth, { label: string; description: string }> = {
  thriving: { label: "Thriving", description: "60%+ of members pick each gameweek" },
  active: { label: "Active", description: "30–60% of members pick each gameweek" },
  quiet: { label: "Quiet", description: "Under 30% of members pick each gameweek" },
  dormant: { label: "Dormant", description: `Nobody picked in the last ${RECENT_ROUNDS} gameweeks` },
  solo: { label: "Solo", description: "Only one human member" },
  finished: { label: "Finished", description: "Its competition is over" },
}

export type LeagueRoundStat = {
  round: Round
  eligible: number
  played: number
  /** Picks made / (eligible members × fixtures in the round). */
  fixtureCoverage: number | null
}

export type LeagueStats = {
  league: ALeague
  competition: ACompetition | undefined
  members: number
  humans: number
  bots: number
  commissioners: string[]
  /** Members who played at least one recent round. */
  activePickers: number
  /** Mean share of eligible members who played each recent round. */
  participation: number | null
  activeMembers7d: number
  picks: number
  lastPickAt: Date | null
  health: LeagueHealth
  recentRounds: LeagueRoundStat[]
}

export function leagueHealth(input: {
  archived: boolean
  humans: number
  participation: number | null
}): LeagueHealth {
  if (input.archived) return "finished"
  if (input.humans <= 1) return "solo"
  if (input.participation === null) return "quiet"
  if (input.participation === 0) return "dormant"
  if (input.participation >= 0.6) return "thriving"
  if (input.participation >= 0.3) return "active"
  return "quiet"
}

/** Per-round participation for one league, for its last `n` started rounds. */
export function leagueRoundStats(
  ds: AnalyticsDataset,
  index: Index,
  leagueId: string,
  n: number,
): LeagueRoundStat[] {
  const league = index.leagueById.get(leagueId)
  if (!league) return []
  const members = index.membershipsByLeague.get(leagueId) ?? []
  const rounds = recentStartedRounds(index.rounds.get(league.competitionId), n)
  return rounds.map((round) => {
    const fixtureIds = new Set(round.fixtureIds)
    let eligibleCount = 0
    let playedCount = 0
    let picks = 0
    for (const m of members) {
      if (!eligible(round, m.joinedAt)) continue
      eligibleCount++
      if (index.playedRounds.get(m.userId)?.has(round.key)) playedCount++
      for (const p of index.predictionsByUser.get(m.userId) ?? []) {
        if (fixtureIds.has(p.fixtureId)) picks++
      }
    }
    const slots = eligibleCount * round.fixtureIds.length
    return {
      round,
      eligible: eligibleCount,
      played: playedCount,
      fixtureCoverage: slots > 0 ? Math.min(1, picks / slots) : null,
    }
  })
}

export function computeLeagueStats(ds: AnalyticsDataset, index = buildIndex(ds)): LeagueStats[] {
  const userById = new Map(ds.users.map((u) => [u.id, u]))
  const day7 = addDays(activityDayKey(ds.now), -6)

  return ds.leagues.map((league) => {
    const competition = index.competitionById.get(league.competitionId)
    const members = index.membershipsByLeague.get(league.id) ?? []
    const competitionFixtures = new Set(
      (index.rounds.get(league.competitionId) ?? []).flatMap((r) => r.fixtureIds),
    )
    const recentRounds = leagueRoundStats(ds, index, league.id, RECENT_ROUNDS)
    const recentKeys = new Set(recentRounds.map((r) => r.round.key))

    let bots = 0
    let activePickers = 0
    let activeMembers7d = 0
    let picks = 0
    let lastPickAt: Date | null = null
    const commissioners: string[] = []
    for (const m of members) {
      const user = userById.get(m.userId)
      if (user?.isBot) bots++
      if (m.role === "COMMISSIONER" && user) commissioners.push(user.displayName)
      const played = index.playedRounds.get(m.userId)
      if (played && [...recentKeys].some((k) => played.has(k))) activePickers++
      if ((index.activityByUser.get(m.userId) ?? []).some((a) => a.day >= day7)) activeMembers7d++
      for (const p of index.predictionsByUser.get(m.userId) ?? []) {
        if (!competitionFixtures.has(p.fixtureId)) continue
        picks++
        if (!lastPickAt || p.createdAt > lastPickAt) lastPickAt = p.createdAt
      }
    }

    const measured = recentRounds.filter((r) => r.eligible > 0)
    const participation =
      measured.length > 0
        ? measured.reduce((sum, r) => sum + r.played / r.eligible, 0) / measured.length
        : null
    const humans = members.length - bots

    return {
      league,
      competition,
      members: members.length,
      humans,
      bots,
      commissioners,
      activePickers,
      participation,
      activeMembers7d,
      picks,
      lastPickAt,
      health: leagueHealth({ archived: !!competition?.archivedAt, humans, participation }),
      recentRounds,
    }
  })
}

// ── Return frequency & retention ───────────────────────────────────────────

export type DailyActive = { day: string; returning: number; firstVisit: number }

/**
 * Distinct users active each day over the last `days` days, split into users
 * on their first-ever active day and users coming back.
 */
export function dailyActive(
  ds: AnalyticsDataset,
  days: number,
  include: (userId: string) => boolean,
): DailyActive[] {
  const today = activityDayKey(ds.now)
  const from = addDays(today, -(days - 1))
  const firstDay = new Map<string, string>()
  for (const a of ds.activity) {
    if (!include(a.userId)) continue
    const prev = firstDay.get(a.userId)
    if (!prev || a.day < prev) firstDay.set(a.userId, a.day)
  }
  const counts = new Map<string, DailyActive>(
    dayRange(from, today).map((day) => [day, { day, returning: 0, firstVisit: 0 }]),
  )
  for (const a of ds.activity) {
    const row = counts.get(a.day)
    if (!row || !include(a.userId)) continue
    if (firstDay.get(a.userId) === a.day) row.firstVisit++
    else row.returning++
  }
  return [...counts.values()]
}

export const RETURN_BUCKETS = [
  { label: "1 day", min: 1, max: 1 },
  { label: "2–3", min: 2, max: 3 },
  { label: "4–7", min: 4, max: 7 },
  { label: "8–14", min: 8, max: 14 },
  { label: "15+", min: 15, max: Infinity },
] as const

/** How many players were active on N distinct days in the last 30. */
export function returnFrequency(players: PlayerStats[]): Array<{ label: string; count: number }> {
  return RETURN_BUCKETS.map((b) => ({
    label: b.label,
    count: players.filter((p) => p.activeDays30 >= b.min && p.activeDays30 <= b.max).length,
  }))
}

export type Cohort = {
  week: string
  size: number
  /** Share of the cohort active in week k after sign-up; null = not happened yet. */
  weeks: Array<number | null>
}

/** Weekly sign-up cohorts (newest last) and the share active each following week. */
export function weeklyRetention(
  ds: AnalyticsDataset,
  cohorts: number,
  include: (user: AUser) => boolean,
): Cohort[] {
  const thisWeek = weekStart(activityDayKey(ds.now))
  const firstWeek = addDays(thisWeek, -7 * (cohorts - 1))
  const weeksActive = new Map<string, Set<string>>()
  for (const a of ds.activity) {
    const set = weeksActive.get(a.userId) ?? new Set<string>()
    set.add(weekStart(a.day))
    weeksActive.set(a.userId, set)
  }
  const members = new Map<string, string[]>()
  for (const u of ds.users) {
    if (!include(u)) continue
    const week = weekStart(activityDayKey(u.createdAt))
    if (week < firstWeek) continue
    const list = members.get(week) ?? []
    list.push(u.id)
    members.set(week, list)
  }
  const out: Cohort[] = []
  for (let i = 0; i < cohorts; i++) {
    const week = addDays(firstWeek, 7 * i)
    const ids = members.get(week) ?? []
    const weeks: Array<number | null> = []
    for (let k = 0; k < cohorts; k++) {
      const target = addDays(week, 7 * k)
      if (target > thisWeek) weeks.push(null)
      else if (ids.length === 0) weeks.push(null)
      else weeks.push(ids.filter((id) => weeksActive.get(id)?.has(target)).length / ids.length)
    }
    out.push({ week, size: ids.length, weeks })
  }
  return out
}

/** Of the users active 8–14 days ago, the share active again in the last 7 days. */
export function weekOverWeekReturn(
  ds: AnalyticsDataset,
  include: (userId: string) => boolean,
): { previous: number; returned: number; rate: number | null } {
  const today = activityDayKey(ds.now)
  const thisFrom = addDays(today, -6)
  const prevFrom = addDays(today, -13)
  const prev = new Set<string>()
  const current = new Set<string>()
  for (const a of ds.activity) {
    if (!include(a.userId)) continue
    if (a.day >= thisFrom) current.add(a.userId)
    else if (a.day >= prevFrom) prev.add(a.userId)
  }
  const returned = [...prev].filter((id) => current.has(id)).length
  return { previous: prev.size, returned, rate: prev.size > 0 ? returned / prev.size : null }
}

/** Mean of DAU / MAU over the last `days` days — "stickiness". */
export function stickiness(ds: AnalyticsDataset, days: number, include: (userId: string) => boolean): number | null {
  const today = activityDayKey(ds.now)
  const byDay = new Map<string, Set<string>>()
  for (const a of ds.activity) {
    if (!include(a.userId)) continue
    const set = byDay.get(a.day) ?? new Set<string>()
    set.add(a.userId)
    byDay.set(a.day, set)
  }
  const ratios: number[] = []
  for (const day of dayRange(addDays(today, -(days - 1)), today)) {
    const monthly = new Set<string>()
    for (const d of dayRange(addDays(day, -29), day)) {
      for (const id of byDay.get(d) ?? []) monthly.add(id)
    }
    if (monthly.size > 0) ratios.push((byDay.get(day)?.size ?? 0) / monthly.size)
  }
  return ratios.length > 0 ? ratios.reduce((a, b) => a + b, 0) / ratios.length : null
}

// ── Funnel ─────────────────────────────────────────────────────────────────

export type FunnelStep = { label: string; count: number }

export function engagementFunnel(players: PlayerStats[]): FunnelStep[] {
  return [
    { label: "Signed up", count: players.length },
    { label: "Verified email", count: players.filter((p) => p.user.emailVerifiedAt).length },
    { label: "Joined a league", count: players.filter((p) => p.leagueCount > 0).length },
    { label: "Made a pick", count: players.filter((p) => p.picks > 0).length },
    {
      label: `Picked in the last ${RECENT_ROUNDS} gameweeks`,
      count: players.filter((p) => p.recentPlayed > 0).length,
    },
    { label: "Back in the last 7 days", count: players.filter((p) => p.activeDays7 > 0).length },
  ]
}

// ── Competitions ───────────────────────────────────────────────────────────

export type CompetitionRoundStat = {
  round: Round
  eligible: number
  played: number
  picks: number
}

/** Platform-wide participation per round for one competition, last `n` started rounds. */
export function competitionRoundStats(
  ds: AnalyticsDataset,
  index: Index,
  competitionId: string,
  n: number,
  include: (userId: string) => boolean,
): CompetitionRoundStat[] {
  const rounds = recentStartedRounds(index.rounds.get(competitionId), n)
  const joined: Array<[string, Date]> = []
  for (const [userId, perComp] of index.joinedCompetition) {
    const at = perComp.get(competitionId)
    if (at && include(userId)) joined.push([userId, at])
  }
  return rounds.map((round) => {
    const fixtureIds = new Set(round.fixtureIds)
    let eligibleCount = 0
    let playedCount = 0
    let picks = 0
    for (const [userId, at] of joined) {
      if (!eligible(round, at)) continue
      eligibleCount++
      if (index.playedRounds.get(userId)?.has(round.key)) playedCount++
      for (const p of index.predictionsByUser.get(userId) ?? []) {
        if (fixtureIds.has(p.fixtureId)) picks++
      }
    }
    return { round, eligible: eligibleCount, played: playedCount, picks }
  })
}

// ── Players: per-round history and timing ──────────────────────────────────

export type PlayerRound = {
  round: Round
  competition: ACompetition | undefined
  fixtures: number
  picks: number
  points: number | null
  banker: boolean
}

/** A player's last `n` eligible started rounds across all their competitions, newest last. */
export function playerRounds(
  ds: AnalyticsDataset,
  index: Index,
  userId: string,
  n: number,
): PlayerRound[] {
  const joined = index.joinedCompetition.get(userId) ?? new Map<string, Date>()
  const predictions = index.predictionsByUser.get(userId) ?? []
  const byFixture = new Map(predictions.map((p) => [p.fixtureId, p]))
  const rounds: Round[] = []
  for (const [competitionId, at] of joined) {
    for (const r of index.rounds.get(competitionId) ?? []) if (eligible(r, at)) rounds.push(r)
  }
  rounds.sort((a, b) => a.firstKickoff.getTime() - b.firstKickoff.getTime())
  return rounds.slice(-n).map((round) => {
    let picks = 0
    let points: number | null = null
    let banker = false
    for (const fid of round.fixtureIds) {
      const p = byFixture.get(fid)
      if (!p) continue
      picks++
      if (p.isBanker) banker = true
      if (p.pointsAwarded !== null) points = (points ?? 0) + p.pointsAwarded
    }
    return {
      round,
      competition: index.competitionById.get(round.competitionId),
      fixtures: round.fixtureIds.length,
      picks,
      points,
      banker,
    }
  })
}

/** Median hours between a player's first pick on a fixture and its kickoff. */
export function medianLeadHours(ds: AnalyticsDataset, index: Index, userId: string): number | null {
  const hours: number[] = []
  for (const p of index.predictionsByUser.get(userId) ?? []) {
    const f = index.fixtureById.get(p.fixtureId)
    if (!f) continue
    const lead = (f.kickoffTime.getTime() - p.createdAt.getTime()) / (60 * 60 * 1000)
    if (lead >= 0) hours.push(lead)
  }
  if (hours.length === 0) return null
  hours.sort((a, b) => a - b)
  const mid = Math.floor(hours.length / 2)
  return hours.length % 2 ? hours[mid] : (hours[mid - 1] + hours[mid]) / 2
}

// ── League members ─────────────────────────────────────────────────────────

export type LeagueMemberStats = {
  membership: AMembership
  user: AUser | undefined
  /** Picks on this league's competition. */
  picks: number
  /** Rounds of this competition since joining this league. */
  roundsEligible: number
  roundsPlayed: number
  recentEligible: number
  recentPlayed: number
  lastPickAt: Date | null
}

/** How each member of one league has played that league's competition since joining it. */
export function leagueMemberStats(ds: AnalyticsDataset, index: Index, leagueId: string): LeagueMemberStats[] {
  const league = index.leagueById.get(leagueId)
  if (!league) return []
  const userById = new Map(ds.users.map((u) => [u.id, u]))
  const rounds = index.rounds.get(league.competitionId) ?? []
  const recent = new Set(recentStartedRounds(rounds).map((r) => r.key))
  const fixtures = new Set(rounds.flatMap((r) => r.fixtureIds))
  return (index.membershipsByLeague.get(leagueId) ?? []).map((membership) => {
    const played = index.playedRounds.get(membership.userId) ?? new Set<string>()
    let roundsEligible = 0
    let roundsPlayed = 0
    let recentEligible = 0
    let recentPlayed = 0
    for (const r of rounds) {
      if (!eligible(r, membership.joinedAt)) continue
      roundsEligible++
      if (played.has(r.key)) roundsPlayed++
      if (recent.has(r.key)) {
        recentEligible++
        if (played.has(r.key)) recentPlayed++
      }
    }
    let picks = 0
    let lastPickAt: Date | null = null
    for (const p of index.predictionsByUser.get(membership.userId) ?? []) {
      if (!fixtures.has(p.fixtureId)) continue
      picks++
      if (!lastPickAt || p.createdAt > lastPickAt) lastPickAt = p.createdAt
    }
    return {
      membership,
      user: userById.get(membership.userId),
      picks,
      roundsEligible,
      roundsPlayed,
      recentEligible,
      recentPlayed,
      lastPickAt,
    }
  })
}
