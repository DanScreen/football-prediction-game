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
  register as apiRegister,
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
  refreshProfile: () => Promise<void>
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
      setUser({
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        isBot: profile.isBot,
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await clearTokens()
      }
      setUser(null)
      setMe(null)
    }
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

  const refreshProfile = useCallback(async () => {
    const profile = await fetchMe()
    setMe(profile)
    setUser({
      id: profile.id,
      email: profile.email,
      displayName: profile.displayName,
      isBot: profile.isBot,
    })
  }, [])

  const value = useMemo(
    () => ({ user, me, isLoading, login, register, logout, refreshProfile }),
    [user, me, isLoading, login, register, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
