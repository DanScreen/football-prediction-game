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

export type MeResponse = MobileUser & {
  leagues: Array<{
    id: string
    name: string
    role: string
    competitionId: string
    competitionName: string
  }>
}

export type AuthTokensResponse = {
  user: MobileUser
  accessToken: string
  refreshToken: string
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
  /** Skip Authorization header (login/register/refresh). */
  auth?: boolean
  /** Internal: avoid infinite refresh loops. */
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

/**
 * Authenticated (by default) JSON request to `/api/mobile/v1`.
 * On 401, attempts one refresh + retry.
 */
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
    // Still clear local tokens if the network call fails.
  }
}

export async function fetchRules(): Promise<{
  exact: number
  close: number
  correctResult: number
  bankerMultiplier: number
  streakTiers: Array<{ minCorrect: number; points: number }>
}> {
  return apiRequest("/rules")
}
