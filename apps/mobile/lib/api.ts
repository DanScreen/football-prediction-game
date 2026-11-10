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
  /**
   * False until the user clicks the link in the verification email; the server
   * refuses player endpoints until then. Optional because a server deployed
   * before verification existed doesn't send it — treat a missing value as
   * verified (that server wouldn't gate anything).
   */
  emailVerified?: boolean
  /**
   * Site-relative URL of their profile picture; null = show initials. Missing
   * from servers that predate profile pictures, which reads the same as null.
   */
  avatarUrl?: string | null
}

export type LeagueSummary = {
  id: string
  name: string
  inviteCode?: string
  role: string
  competitionId: string
  competitionName: string
  /** Set when a host has declared the competition finished. */
  competitionArchived?: boolean
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
  avatarUrl?: string | null
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

export type FormTier = "strong" | "mixed" | "poor" | "none"

/** One cell of the last-5-rounds form strip, oldest → newest. */
export type FormCell = {
  round: string
  tier: FormTier
  scored: number
}

export type LeaderboardEntry = {
  rank: number
  id: string
  displayName: string
  isBot: boolean
  avatarUrl?: string | null
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
  /** One cell per `LeaderboardBlock.formRounds` entry, in the same order. */
  form: FormCell[]
}

export type LeaderboardBlock = {
  leagueId: string
  leagueName: string
  competitionName: string
  /** Round names behind the form strip, oldest → newest. */
  formRounds: string[]
  /**
   * Every round that has kicked off, newest first — the range the gameweek
   * picker cycles through. Empty before a competition's first kickoff.
   *
   * Optional because the app and the server version independently: a build can
   * always meet a server deployed before this field existed, and must fall back
   * to the overall table rather than crash. Treat a missing value as none.
   */
  playedRounds?: string[]
  standings: LeaderboardEntry[]
}

/** One league's standings for a single round. */
export type RoundLeaderboard = {
  leagueId: string
  round: string
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
  /** Machine-readable reason, when the server gives one (e.g. `email_unverified`). */
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/**
 * Called when any request is refused with `email_unverified` — the auth
 * context uses it to route to the verify screen if its idea of the user is
 * stale. Set once by `AuthProvider`.
 */
let onEmailUnverified: (() => void) | null = null
export function setEmailUnverifiedHandler(handler: (() => void) | null) {
  onEmailUnverified = handler
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

async function parseError(res: Response): Promise<{ message: string; code?: string }> {
  try {
    const data = (await res.json()) as { error?: string; code?: string }
    if (data.error) return { message: data.error, code: data.code }
  } catch {
    /* ignore */
  }
  return { message: res.statusText || `Request failed (${res.status})` }
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
    const { message, code } = await parseError(res)
    if (code === "email_unverified") onEmailUnverified?.()
    throw new ApiError(res.status, message, code)
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

/** Send (or re-send) the verification link. 429 inside the resend cooldown. */
export async function resendVerification(): Promise<{ status: "sent" | "already-verified" }> {
  return apiRequest("/auth/resend-verification", { method: "POST" })
}

/**
 * Correct a mistyped address while still unverified; a new link goes to it.
 * `warning` is set when the address changed but the link couldn't be sent.
 */
export async function changeEmail(
  email: string,
): Promise<{ email: string; emailVerified: boolean; warning?: string }> {
  return apiRequest("/me", { method: "PATCH", body: { email } })
}

/**
 * Set the profile picture from base64 image data (what the image picker
 * returns). The server crops, resizes and re-encodes it.
 */
export async function uploadAvatar(base64: string): Promise<{ avatarUrl: string }> {
  return apiRequest("/me/avatar", { method: "PUT", body: { image: base64 } })
}

/** Remove the profile picture; initials show instead. */
export async function removeAvatar(): Promise<{ avatarUrl: null }> {
  return apiRequest("/me/avatar", { method: "DELETE" })
}

/** Permanent, irreversible account deletion (App Store guideline 5.1.1(v)). */
export async function deleteAccount(): Promise<void> {
  await apiRequest<void>("/me", { method: "DELETE" })
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

/** Viewer's streak bonuses, rolled up per competition + round. */
export type BonusRound = {
  competitionId: string
  round: string
  points: number
}

export async function fetchBonuses(): Promise<BonusRound[]> {
  return apiRequest("/bonuses")
}

export async function fetchLeaderboards(): Promise<LeaderboardBlock[]> {
  return apiRequest("/leaderboards")
}

/**
 * A single gameweek's table. Fetched only when a player opens the gameweek
 * view — the round *names* already arrive with `fetchLeaderboards`.
 */
export async function fetchRoundLeaderboard(
  leagueId: string,
  round: string,
): Promise<RoundLeaderboard> {
  const query = `?leagueId=${encodeURIComponent(leagueId)}&round=${encodeURIComponent(round)}`
  return apiRequest(`/leaderboards/round${query}`)
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
