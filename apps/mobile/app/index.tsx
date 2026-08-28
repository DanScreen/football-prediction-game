import { Redirect } from "expo-router"
import { useAuth } from "@/lib/auth"

/** Default entry: send people to tabs or login — never land on /join. */
export default function Index() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  if (user) return <Redirect href="/(tabs)" />
  return <Redirect href="/(auth)/login" />
}
