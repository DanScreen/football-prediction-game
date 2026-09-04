import { useState } from "react"
import { Linking, Pressable, ScrollView, Text, View } from "react-native"
import { ErrorBanner, Field, PrimaryButton, Screen, screenPadding } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/config"
import { useTokens } from "@/lib/theme"

/**
 * The native counterpart to the web `/profile` page.
 *
 * Its reason for existing is account deletion: App Store guideline 5.1.1(v)
 * requires an app that creates accounts to let people delete them from inside
 * the app. API-key management stays on the website — bots are a desktop
 * activity and the key is not something to expose on a phone screen.
 */
export default function AccountScreen() {
  const t = useTokens()
  const { user, logout, deleteAccount } = useAuth()
  const [confirm, setConfirm] = useState("")
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const matches = confirm.trim().toLowerCase() === (user?.email ?? "").toLowerCase()

  async function onDelete() {
    setError(null)
    setBusy(true)
    try {
      await deleteAccount()
      // No navigation needed: the root layout's `Stack.Protected` guard sends
      // the app back to the auth stack as soon as `user` becomes null.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete your account.")
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={screenPadding.scrollContent}>
        <View
          style={{
            backgroundColor: t.surface,
            borderColor: t.line,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            gap: 10,
          }}
        >
          <Row label="Display name" value={user?.displayName ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
        </View>

        <Pressable
          onPress={() => void Linking.openURL(`${API_BASE_URL}/profile`)}
          style={{ paddingVertical: 4 }}
        >
          <Text style={{ color: t.pitch, fontWeight: "700" }}>
            Manage your API key on the website →
          </Text>
        </Pressable>

        {/* Reachable from inside the app, not just the store listing: this screen
            is where someone decides whether to delete their account, and the
            policy is what tells them what that removes. */}
        <Pressable
          onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)}
          style={{ paddingVertical: 4 }}
          accessibilityRole="link"
        >
          <Text style={{ color: t.pitch, fontWeight: "700" }}>Privacy policy →</Text>
        </Pressable>

        <PrimaryButton label="Sign out" onPress={() => void logout()} />

        <View
          style={{
            backgroundColor: t.surface,
            borderColor: t.badLine,
            borderWidth: 1,
            borderRadius: 12,
            padding: 16,
            gap: 10,
            marginTop: 8,
          }}
        >
          <Text
            style={{ fontSize: 13, fontWeight: "700", color: t.bad, letterSpacing: 0.6 }}
          >
            DELETE ACCOUNT
          </Text>
          <Text style={{ color: t.inkMuted, fontSize: 13, lineHeight: 20 }}>
            This permanently removes your account, your predictions and your standings in
            every league. It cannot be undone. Leagues you started stay open for the other
            players.
          </Text>

          <ErrorBanner message={error} />

          {armed ? (
            <>
              <Field
                label={`Type ${user?.email ?? "your email"} to confirm`}
                value={confirm}
                onChangeText={setConfirm}
                keyboardType="email-address"
                placeholder={user?.email}
              />
              <Pressable
                onPress={() => void onDelete()}
                disabled={!matches || busy}
                style={{
                  backgroundColor: matches && !busy ? t.bad : t.chip,
                  borderRadius: 10,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: matches && !busy ? "#ffffff" : t.inkMuted,
                    fontWeight: "700",
                    fontSize: 15,
                  }}
                >
                  {busy ? "Deleting…" : "Delete my account permanently"}
                </Text>
              </Pressable>
              <Pressable onPress={() => setArmed(false)} style={{ alignItems: "center", paddingVertical: 8 }}>
                <Text style={{ color: t.inkMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <Pressable
              onPress={() => setArmed(true)}
              style={{
                backgroundColor: t.badTint,
                borderColor: t.badLine,
                borderWidth: 1,
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: t.bad, fontWeight: "700" }}>Delete account…</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Text style={{ color: t.inkMuted, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: t.ink, fontSize: 14, fontWeight: "600", flexShrink: 1 }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}
