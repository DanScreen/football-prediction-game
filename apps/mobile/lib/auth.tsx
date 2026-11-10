import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  ApiError,
  fetchMe,
  login as apiLogin,
  logoutRemote,
  deleteAccount as apiDeleteAccount,
  register as apiRegister,
  resendVerification as apiResendVerification,
  changeEmail as apiChangeEmail,
  setEmailUnverifiedHandler,
  type MeResponse,
  type MobileUser,
} from "@/lib/api"
import { clearTokens, loadTokens, saveTokens } from "@/lib/tokenStorage"

type AuthContextValue = {
  user: MobileUser | null
  me: MeResponse | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (input: {
    email: string
    password: string
    displayName: string
    inviteCode?: string
  }) => Promise<void>
  logout: () => Promise<void>
  /** Permanent account deletion. Signs out locally once the server confirms. */
  deleteAccount: () => Promise<void>
  refreshProfile: () => Promise<void>
  /** Re-send the verification link. Throws `ApiError` (429 during the cooldown). */
  resendVerification: () => Promise<void>
  /**
   * Fix a mistyped address while unverified. Resolves to a warning when the
   * address changed but the new link couldn't be sent.
   */
  changeEmail: (email: string) => Promise<string | undefined>
  /** Record a new (or removed) profile picture after the server accepted it. */
  setAvatarUrl: (avatarUrl: string | null) => void
}

function toUser(profile: MeResponse): MobileUser {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    isBot: profile.isBot,
    emailVerified: profile.emailVerified,
    avatarUrl: profile.avatarUrl,
  }
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const hydrate = useCallback(async () => {
    const { accessToken, refreshToken } = await loadTokens()
    if (!accessToken && !refreshToken) {
      setUser(null)
      setMe(null)
      return
    }
    try {
      const profile = await fetchMe()
      setMe(profile)
      setUser(toUser(profile))
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearTokens()
      }
      setUser(null)
      setMe(null)
    }
  }, [])

  // A gated endpoint said "verify first" — our copy of the user is stale (or
  // predates the field), so flip it and the root layout shows the verify screen.
  useEffect(() => {
    setEmailUnverifiedHandler(() => {
      setUser((u) => (u && u.emailVerified !== false ? { ...u, emailVerified: false } : u))
    })
    return () => setEmailUnverifiedHandler(null)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await hydrate()
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrate])

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email.trim().toLowerCase(), password)
    await saveTokens(result.accessToken, result.refreshToken)
    setUser(result.user)
    const profile = await fetchMe()
    setMe(profile)
  }, [])

  const register = useCallback(
    async (input: {
      email: string
      password: string
      displayName: string
      inviteCode?: string
    }) => {
      const result = await apiRegister({
        ...input,
        email: input.email.trim().toLowerCase(),
        displayName: input.displayName.trim(),
        inviteCode: input.inviteCode?.trim() || undefined,
      })
      await saveTokens(result.accessToken, result.refreshToken)
      setUser(result.user)
      const profile = await fetchMe()
      setMe(profile)
    },
    [],
  )

  const logout = useCallback(async () => {
    await logoutRemote()
    await clearTokens()
    setUser(null)
    setMe(null)
  }, [])

  const deleteAccount = useCallback(async () => {
    // No local sign-out first: if the request fails the user still has an
    // account, and dropping their tokens would strand them signed out of it.
    await apiDeleteAccount()
    await clearTokens()
    setUser(null)
    setMe(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    const profile = await fetchMe()
    setMe(profile)
    setUser(toUser(profile))
  }, [])

  const resendVerification = useCallback(async () => {
    const result = await apiResendVerification()
    // Verified in the meantime (link clicked elsewhere) — pick that up.
    if (result.status === "already-verified") await refreshProfile()
  }, [refreshProfile])

  const changeEmail = useCallback(async (email: string) => {
    const result = await apiChangeEmail(email.trim().toLowerCase())
    setUser((u) => (u ? { ...u, email: result.email } : u))
    setMe((m) => (m ? { ...m, email: result.email } : m))
    return result.warning
  }, [])

  const setAvatarUrl = useCallback((avatarUrl: string | null) => {
    setUser((u) => (u ? { ...u, avatarUrl } : u))
    setMe((m) => (m ? { ...m, avatarUrl } : m))
  }, [])

  const value = useMemo(
    () => ({
      user,
      me,
      isLoading,
      login,
      register,
      logout,
      deleteAccount,
      refreshProfile,
      resendVerification,
      changeEmail,
      setAvatarUrl,
    }),
    [
      user,
      me,
      isLoading,
      login,
      register,
      logout,
      deleteAccount,
      refreshProfile,
      resendVerification,
      changeEmail,
      setAvatarUrl,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
