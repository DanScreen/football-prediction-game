import { Stack } from "expo-router"
import { useTokens } from "@/lib/theme"

export default function AuthLayout() {
  const t = useTokens()
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.ground },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.ground },
      }}
    >
      <Stack.Screen name="login" options={{ title: "Sign in" }} />
      <Stack.Screen name="register" options={{ title: "Create account" }} />
    </Stack>
  )
}
