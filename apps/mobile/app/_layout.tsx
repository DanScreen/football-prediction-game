import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { useColorScheme } from "react-native"
import { AuthProvider, useAuth } from "@/lib/auth"
import { registerForPushReminders } from "@/lib/notifications"
import { useTokens } from "@/lib/theme"

export { ErrorBoundary } from "expo-router"

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  )
}

function RootNavigator() {
  const { isLoading, user } = useAuth()
  const t = useTokens()
  const scheme = useColorScheme()

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading])

  useEffect(() => {
    if (user) {
      void registerForPushReminders().catch(() => {
        /* permission denied or Expo Go project id — non-fatal */
      })
    }
  }, [user])

  if (isLoading) {
    return null
  }

  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.ground },
          headerTintColor: t.ink,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: t.ground },
        }}
      >
        <Stack.Screen name="join" options={{ title: "Join league", presentation: "modal" }} />
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </>
  )
}
