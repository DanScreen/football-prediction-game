import { Text, View } from "react-native"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"
import { PlaceholderCard, Screen, screenPadding } from "@/components/ui"

export default function PredictionsScreen() {
  const { user } = useAuth()
  const t = useTokens()

  return (
    <Screen>
      <View style={screenPadding.pad}>
        <Text style={{ fontSize: 15, color: t.inkMuted }}>
          Signed in as {user?.displayName}
        </Text>
        <PlaceholderCard
          title="Fixtures coming in Phase 3"
          body="Open fixtures, score entry, and the banker will land here — wired to GET/POST /api/mobile/v1/fixtures and /predictions."
        />
      </View>
    </Screen>
  )
}
