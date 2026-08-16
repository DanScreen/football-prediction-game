import { View } from "react-native"
import { PlaceholderCard, Screen, screenPadding } from "@/components/ui"

export default function LeaderboardScreen() {
  return (
    <Screen>
      <View style={screenPadding.pad}>
        <PlaceholderCard
          title="Standings coming in Phase 3"
          body="Stacked league leaderboards will load from GET /api/mobile/v1/leaderboards, with provisional points badged in amber."
        />
      </View>
    </Screen>
  )
}
