import { Link, useLocalSearchParams } from "expo-router"
import { useEffect, useState } from "react"
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from "react-native"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/config"
import { INVALID_EMAIL_MESSAGE, isValidEmail } from "@/lib/emailAddress"
import { useTokens } from "@/lib/theme"
import {
  BrandMark,
  ErrorBanner,
  Field,
  PrimaryButton,
  Screen,
  screenPadding,
} from "@/components/ui"

export default function RegisterScreen() {
  const { register } = useAuth()
  const t = useTokens()
  const params = useLocalSearchParams<{ inviteCode?: string }>()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fromLink = typeof params.inviteCode === "string" ? params.inviteCode : ""
    if (fromLink) setInviteCode(fromLink)
  }, [params.inviteCode])

  async function onSubmit() {
    setError(null)
    if (!isValidEmail(email.trim().toLowerCase())) {
      setError(INVALID_EMAIL_MESSAGE)
      return
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    setLoading(true)
    try {
      await register({
        displayName,
        email,
        password,
        inviteCode: inviteCode || undefined,
      })
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not create your account. Check your connection.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={screenPadding.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4, marginTop: 8, marginBottom: 8 }}>
            <BrandMark />
            <Text style={{ fontSize: 16, color: t.inkMuted, marginTop: 4 }}>
              Join a league and start predicting.
            </Text>
          </View>

          <ErrorBanner message={error} />

          <Field
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            textContentType="name"
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
          />
          <Field
            label="Invite code (optional)"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="characters"
          />

          <PrimaryButton
            label="Create account"
            onPress={onSubmit}
            loading={loading}
            disabled={!displayName || !email || !password}
          />

          <Link href="/(auth)/login" style={{ paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: t.pitch, fontSize: 15, fontWeight: "600" }}>
              Already have an account? Sign in
            </Text>
          </Link>

          {/* App Store review looks for the policy at the point of sign-up, not
              only in the listing metadata. */}
          <Pressable
            onPress={() => void Linking.openURL(`${API_BASE_URL}/privacy`)}
            accessibilityRole="link"
            style={{ paddingVertical: 6, alignItems: "center" }}
          >
            <Text style={{ color: t.inkMuted, fontSize: 13 }}>
              By creating an account you agree to our{" "}
              <Text style={{ color: t.pitch, fontWeight: "600" }}>privacy policy</Text>.
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
