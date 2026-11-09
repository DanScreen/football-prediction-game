import { Stack } from "expo-router"
import * as SplashScreen from "expo-splash-screen"
import { StatusBar } from "expo-status-bar"
import { useEffect } from "react"
import { useColorScheme } from "react-native"
import { AuthProvider, useAuth } from "@/lib/auth"
import { registerForPushReminders } from "@/lib/notifications"
import { useTokens } from "@/lib/theme"

export { ErrorBoundary } from "expo-router"

export const unstable_settings = {
  initialRouteName: "index",
}

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
  // Missing (a server from before verification) counts as verified.
  const verified = !!user && user.emailVerified !== false
  const unverified = !!user && user.emailVerified === false
  const t = useTokens()
  const scheme = useColorScheme()

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync()
    }
  }, [isLoading])

  // No push until verified: the server won't accept the device (403) and
  // doesn't send reminders to unverified accounts anyway.
  useEffect(() => {
    if (verified) {
      void registerForPushReminders().catch(() => {
        /* permission denied or missing EAS project id — non-fatal */
      })
    }
  }, [verified])

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
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={verified}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={unverified}>
          <Stack.Screen name="verify-email" options={{ title: "Verify your email" }} />
        </Stack.Protected>
        <Stack.Protected guard={!user}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        {/* Open to unverified users too, so they can delete an account they
            can't verify (App Store 5.1.1(v)). */}
        <Stack.Protected guard={!!user}>
          <Stack.Screen name="account" options={{ title: "Account" }} />
          <Stack.Screen name="rules" options={{ title: "How it works" }} />
        </Stack.Protected>
        <Stack.Screen
          name="join"
          options={{ title: "Join league", presentation: "modal" }}
        />
      </Stack>
    </>
  )
}
