import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import { fetchLeaderboards, type LeaderboardEntry } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

export default function LeaderboardScreen() {
  const { user } = useAuth()
  const t = useTokens()
  const { data, error, loading, refreshing, reload } = useAsyncData(() => fetchLeaderboards(), [])

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={screenPadding.pad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void reload(true)} tintColor={t.pitch} />
        }
      >
        <ErrorBanner message={error} />
        {loading && !data ? <ActivityIndicator color={t.pitch} /> : null}

        {!loading && data?.length === 0 ? (
          <Text style={{ color: t.inkMuted, lineHeight: 22 }}>
            Join a league to see standings here.
          </Text>
        ) : null}

        {data?.map((block) => (
          <View key={block.leagueId} style={{ gap: 10, marginBottom: 8 }}>
            <View
              style={{
                backgroundColor: t.board,
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: t.boardGold, fontWeight: "700", fontSize: 16 }}>
                {block.leagueName}
              </Text>
              <Text style={{ color: t.boardMuted, marginTop: 2 }}>{block.competitionName}</Text>
            </View>

            {block.standings.map((row) => (
              <StandingRow key={row.id} row={row} highlight={row.id === user?.id} />
            ))}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

function StandingRow({ row, highlight }: { row: LeaderboardEntry; highlight: boolean }) {
  const t = useTokens()
  return (
    <View
      style={{
        backgroundColor: highlight ? t.pitchTint : t.surface,
        borderColor: highlight ? t.pitch : t.line,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <Text style={{ width: 28, fontWeight: "700", color: t.ink, fontVariant: ["tabular-nums"] }}>
        {row.rank}
      </Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", color: t.ink }}>
          {row.displayName}
          {row.isBot ? " 🤖" : ""}
        </Text>
        {row.provisionalPoints > 0 ? (
          <Text style={{ color: t.clock, fontSize: 12, marginTop: 2 }}>
            +{row.provisionalPoints} provisional
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontWeight: "700", color: t.ink, fontVariant: ["tabular-nums"] }}>
          {row.totalPoints}
        </Text>
        <Text style={{ color: t.inkFaint, fontSize: 11 }}>pts</Text>
      </View>
    </View>
  )
}
