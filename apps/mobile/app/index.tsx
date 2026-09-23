import { Redirect } from "expo-router"
import { useAuth } from "@/lib/auth"

/** Default entry: send people to tabs, verify or login — never land on /join. */
export default function Index() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user?.emailVerified === false) return <Redirect href="/verify-email" />
  if (user) return <Redirect href="/(tabs)" />
  return <Redirect href="/(auth)/login" />
}
