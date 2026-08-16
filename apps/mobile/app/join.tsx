import { useLocalSearchParams, useRouter } from "expo-router"
import { useEffect, useState } from "react"
import { Text, View } from "react-native"
import { ErrorBanner, PrimaryButton, Screen, screenPadding } from "@/components/ui"
import { ApiError, joinLeague } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"

/**
 * Deep link target: scorers://join?code=ABCDEF
 * Logged-in users join immediately; others are sent to register with the code.
 */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>()
  const invite = typeof code === "string" ? code : Array.isArray(code) ? code[0] : ""
  const { user, isLoading, refreshProfile } = useAuth()
  const router = useRouter()
  const t = useTokens()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (isLoading) return
    if (!invite) {
      setError("Missing invite code.")
      return
    }
    if (!user) {
      router.replace({ pathname: "/(auth)/register", params: { inviteCode: invite } })
    }
  }, [isLoading, user, invite, router])

  async function confirmJoin() {
    if (!invite) return
    setBusy(true)
    setError(null)
    try {
      await joinLeague(invite)
      await refreshProfile()
      router.replace("/(tabs)/leagues")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not join league.")
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    return (
      <Screen>
        <View style={screenPadding.pad}>
          <Text style={{ color: t.inkMuted }}>Opening registration…</Text>
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <View style={screenPadding.pad}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: t.ink }}>Join league</Text>
        <Text style={{ color: t.inkMuted }}>
          Invite code <Text style={{ fontWeight: "700", color: t.ink }}>{invite}</Text>
        </Text>
        <ErrorBanner message={error} />
        <PrimaryButton label="Join" onPress={() => void confirmJoin()} loading={busy} />
        <PrimaryButton label="Cancel" onPress={() => router.back()} />
      </View>
    </Screen>
  )
}
