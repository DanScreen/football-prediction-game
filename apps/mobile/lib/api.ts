import { API_BASE_URL, MOBILE_API_PREFIX } from "@/lib/config"
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
} from "@/lib/tokenStorage"

export type MobileUser = {
  id: string
  email: string
  displayName: string
  isBot: boolean
}

export type LeagueSummary = {
  id: string
  name: string
  inviteCode?: string
  role: string
  competitionId: string
  competitionName: string
}

export type MeResponse = MobileUser & {
  leagues: LeagueSummary[]
}

export type AuthTokensResponse = {
  user: MobileUser
  accessToken: string
  refreshToken: string
}

export type FixturePrediction = {
  userId: string
  displayName: string
  isBot: boolean
  homeScore: number
  awayScore: number
  isBanker: boolean
  pointsAwarded: number | null
  provisionalPoints: number | null
}

export type MobileFixture = {
  id: string
  competitionId: string
  competitionName: string
  round: string
  homeTeam: string
  awayTeam: string
  kickoffTime: string
  status: string
  actualHomeScore: number | null
  actualAwayScore: number | null
  provisionalHomeScore: number | null
  provisionalAwayScore: number | null
  prediction: FixturePrediction | null
  /** League-mate picks — only populated once the fixture has kicked off. */
  peerPredictions: FixturePrediction[]
}

export type LeaderboardEntry = {
  rank: number
  id: string
  displayName: string
  isBot: boolean
  totalPoints: number
  provisionalPoints: number
  projectedPoints: number
  exactCount: number
  streakPoints: number
  pointsBreakdown: {
    result: number
    close: number
    exact: number
    banker: number
    streak: number
  }
}

export type LeaderboardBlock = {
  leagueId: string
  leagueName: string
  competitionName: string
  standings: LeaderboardEntry[]
}

export type CompetitionOption = { id: string; name: string }

export type RulesResponse = {
  exact: number
  close: number
  correctResult: number
  bankerMultiplier: number
  streakTiers: Array<{ minCorrect: number; points: number }>
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

type RequestOptions = {
  method?: string
  body?: unknown
  auth?: boolean
  _retried?: boolean
}

let refreshInFlight: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = (async () => {
    const refreshToken = await getRefreshToken()
    if (!refreshToken) return false
    try {
      const res = await fetch(`${API_BASE_URL}${MOBILE_API_PREFIX}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        await clearTokens()
        return false
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string }
      await saveTokens(data.accessToken, data.refreshToken)
      return true
    } catch {
      return false
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string }
    if (data.error) return data.error
  } catch {
    /* ignore */
  }
  return res.statusText || `Request failed (${res.status})`
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, _retried = false } = options
  const headers: Record<string, string> = { Accept: "application/json" }
  if (body !== undefined) headers["Content-Type"] = "application/json"

  if (auth) {
    const access = await getAccessToken()
    if (access) headers.Authorization = `Bearer ${access}`
  }

  const res = await fetch(`${API_BASE_URL}${MOBILE_API_PREFIX}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth && !_retried) {
    const ok = await tryRefresh()
    if (ok) return apiRequest<T>(path, { ...options, _retried: true })
  }

  if (res.status === 204) return undefined as T

  if (!res.ok) {
    throw new ApiError(res.status, await parseError(res))
  }

  return (await res.json()) as T
}

export async function login(email: string, password: string): Promise<AuthTokensResponse> {
  return apiRequest<AuthTokensResponse>("/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  })
}

export async function register(input: {
  email: string
  password: string
  displayName: string
  inviteCode?: string
}): Promise<AuthTokensResponse> {
  return apiRequest<AuthTokensResponse>("/auth/register", {
    method: "POST",
    auth: false,
    body: input,
  })
}

export async function fetchMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>("/me")
}

export async function logoutRemote(): Promise<void> {
  const refreshToken = await getRefreshToken()
  try {
    await apiRequest<void>("/auth/logout", {
      method: "POST",
      body: refreshToken ? { refreshToken } : {},
    })
  } catch {
    /* clear local anyway */
  }
}

export async function fetchRules(): Promise<RulesResponse> {
  return apiRequest("/rules")
}

export async function fetchFixtures(status?: "open" | "locked" | "completed" | "all"): Promise<MobileFixture[]> {
  const q = status && status !== "all" ? `?status=${status}` : ""
  return apiRequest(`/fixtures${q}`)
}

export async function submitPrediction(input: {
  fixtureId: string
  homeScore: number
  awayScore: number
  isBanker?: boolean
}): Promise<{ prediction: { id: string; isBanker: boolean } }> {
  return apiRequest("/predictions", { method: "POST", body: input })
}

export async function fetchLeaderboards(): Promise<LeaderboardBlock[]> {
  return apiRequest("/leaderboards")
}

export async function fetchLeagues(): Promise<LeagueSummary[]> {
  return apiRequest("/leagues")
}

export async function createLeague(name: string, competitionId: string): Promise<LeagueSummary> {
  return apiRequest("/leagues", { method: "POST", body: { name, competitionId } })
}

export async function joinLeague(inviteCode: string): Promise<LeagueSummary> {
  return apiRequest("/leagues/join", { method: "POST", body: { inviteCode } })
}

export async function fetchCompetitions(): Promise<CompetitionOption[]> {
  return apiRequest("/competitions")
}

export async function registerDeviceToken(token: string, platform: string): Promise<void> {
  await apiRequest("/devices", { method: "POST", body: { token, platform } })
}

export async function unregisterDeviceToken(token: string): Promise<void> {
  await apiRequest("/devices", { method: "DELETE", body: { token } })
}

export async function requestForgotPassword(email: string): Promise<void> {
  await apiRequest("/auth/forgot-password", {
    method: "POST",
    auth: false,
    body: { email },
  })
}
