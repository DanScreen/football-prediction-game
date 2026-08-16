import { Link } from "expo-router"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native"
import { ApiError } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"
import {
  BrandMark,
  ErrorBanner,
  Field,
  PrimaryButton,
  Screen,
  screenPadding,
} from "@/components/ui"
import { API_BASE_URL } from "@/lib/config"

export default function LoginScreen() {
  const { login } = useAuth()
  const t = useTokens()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit() {
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in. Check your connection.")
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
        <ScrollView contentContainerStyle={screenPadding.pad} keyboardShouldPersistTaps="handled">
          <View style={{ gap: 4, marginTop: 24, marginBottom: 8 }}>
            <BrandMark />
            <Text style={{ fontSize: 16, color: t.inkMuted, marginTop: 4 }}>
              Predict scores. Climb the table.
            </Text>
          </View>

          <ErrorBanner message={error} />

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
            textContentType="password"
            autoComplete="password"
          />

          <PrimaryButton
            label="Sign in"
            onPress={onSubmit}
            loading={loading}
            disabled={!email || !password}
          />

          <Link href="/(auth)/register" style={{ paddingVertical: 10, alignItems: "center" }}>
            <Text style={{ color: t.pitch, fontSize: 15, fontWeight: "600" }}>Create an account</Text>
          </Link>

          <Text style={{ fontSize: 12, color: t.inkFaint, textAlign: "center", marginTop: 8 }}>
            API: {API_BASE_URL}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}
