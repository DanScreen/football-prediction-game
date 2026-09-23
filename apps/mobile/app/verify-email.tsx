import { Link } from "expo-router"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native"
import { ErrorBanner, Field, PrimaryButton, Screen, screenPadding } from "@/components/ui"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/config"
import { INVALID_EMAIL_MESSAGE, isValidEmail } from "@/lib/emailAddress"
import { useTokens } from "@/lib/theme"

/**
 * Where every signed-in account whose email isn't verified is held — new
 * sign-ups and existing accounts alike. The link opens in the browser (it's a
 * website URL), so the usual path is: tap the link in Mail, come back here, and
 * the foreground refresh below lets them straight in.
 *
 * No navigation code: the root layout's `Stack.Protected` guards swap this
 * screen for the tabs as soon as `user.emailVerified` turns true.
 */
export default function VerifyEmailScreen() {
  const t = useTokens()
  const { user, refreshProfile, resendVerification, changeEmail, logout } = useAuth()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [changing, setChanging] = useState(false)
  const [newEmail, setNewEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const appState = useRef(AppState.currentState)

  const check = useCallback(
    async (quiet: boolean) => {
      if (!quiet) {
        setError(null)
        setNotice(null)
        setChecking(true)
      }
      try {
        await refreshProfile()
        if (!quiet) setNotice("Not verified yet — tap the link in the email, then try again.")
      } catch (err) {
        if (!quiet) {
          setError(err instanceof ApiError ? err.message : "Couldn't check. Are you online?")
        }
      } finally {
        if (!quiet) setChecking(false)
      }
    },
    [refreshProfile],
  )

  // Coming back from Mail/Safari is the moment they've most likely verified.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (appState.current.match(/inactive|background/) && next === "active") {
        void check(true)
      }
      appState.current = next
    })
    return () => sub.remove()
  }, [check])

  async function onResend() {
    setError(null)
    setNotice(null)
    setSending(true)
    try {
      await resendVerification()
      setNotice("Sent — check your inbox (and your spam folder).")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send the email. Are you online?")
    } finally {
      setSending(false)
    }
  }

  async function onChangeEmail() {
    setError(null)
    setNotice(null)
    if (!isValidEmail(newEmail.trim().toLowerCase())) {
      setError(INVALID_EMAIL_MESSAGE)
      return
    }
    setSaving(true)
    try {
      const warning = await changeEmail(newEmail)
      setChanging(false)
      setNewEmail("")
      if (warning) setError(warning)
      else setNotice("Address updated — we've sent a new link to it.")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't update your email. Are you online?")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={screenPadding.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text style={{ fontSize: 26, fontWeight: "800", color: t.ink }}>Check your inbox</Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: t.inkMuted }}>
              To finish setting up, tap the link we emailed to{" "}
              <Text style={{ fontWeight: "700", color: t.ink }}>{user?.email}</Text>. It can take
              a minute or two, and sometimes lands in spam.
            </Text>
          </View>

          <ErrorBanner message={error} />
          {notice ? (
            <View
              style={{
                backgroundColor: t.goodTint,
                borderColor: t.goodLine,
                borderWidth: 1,
                borderRadius: 10,
                padding: 12,
              }}
            >
              <Text style={{ color: t.good, fontSize: 14 }}>{notice}</Text>
            </View>
          ) : null}

          <PrimaryButton
            label="I've verified — continue"
            onPress={() => void check(false)}
            loading={checking}
          />

          <SecondaryButton
            label={sending ? "Sending…" : "Resend the email"}
            onPress={() => void onResend()}
            disabled={sending}
          />

          {changing ? (
            <View style={{ gap: 12 }}>
              <Field
                label="Correct email address"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder="you@example.com"
              />
              <PrimaryButton
                label="Update and send link"
                onPress={() => void onChangeEmail()}
                loading={saving}
                disabled={!newEmail}
              />
              <Pressable
                onPress={() => setChanging(false)}
                style={{ alignItems: "center", paddingVertical: 8 }}
              >
                <Text style={{ color: t.inkMuted, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => setChanging(true)}
              style={{ alignItems: "center", paddingVertical: 8 }}
            >
              <Text style={{ color: t.inkMuted, fontSize: 15 }}>
                Wrong address? <Text style={{ color: t.pitch, fontWeight: "700" }}>Change it</Text>
              </Text>
            </Pressable>
          )}

          <View style={{ borderTopWidth: 1, borderColor: t.line, paddingTop: 16, gap: 4 }}>
            <Pressable
              onPress={() => void Linking.openURL(`${API_BASE_URL}/support`)}
              accessibilityRole="link"
              style={{ paddingVertical: 6 }}
            >
              <Text style={{ color: t.pitch, fontWeight: "700" }}>Help &amp; support →</Text>
            </Pressable>
            <Link href="/account" style={{ paddingVertical: 6 }}>
              <Text style={{ color: t.pitch, fontWeight: "700" }}>Account &amp; deletion →</Text>
            </Link>
            <Pressable onPress={() => void logout()} style={{ paddingVertical: 6 }}>
              <Text style={{ color: t.inkMuted, fontWeight: "600" }}>Sign out</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  const t = useTokens()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderColor: t.lineStrong,
        borderWidth: 1,
        backgroundColor: pressed ? t.chip : t.surface,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: "center",
        opacity: disabled ? 0.6 : 1,
      })}
    >
      <Text style={{ color: t.ink, fontSize: 16, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  )
}
