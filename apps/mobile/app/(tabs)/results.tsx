import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native"
import { FixtureCard } from "@/components/FixtureCard"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import { fetchFixtures } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

export default function ResultsScreen() {
  const { user } = useAuth()
  const t = useTokens()
  const { data, error, loading, refreshing, reload } = useAsyncData(
    () => fetchFixtures("completed"),
    [],
  )

  const fixtures = data ?? []

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={screenPadding.pad}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void reload(true)} tintColor={t.pitch} />
        }
      >
        <Text style={{ fontSize: 15, color: t.inkMuted, marginBottom: 12 }}>
          Settled fixtures with everyone&apos;s picks
        </Text>
        <ErrorBanner message={error} />

        {loading && !data ? <ActivityIndicator color={t.pitch} /> : null}

        {!loading && fixtures.length === 0 ? (
          <Text style={{ color: t.inkMuted, lineHeight: 22 }}>
            No settled results yet. Once a host confirms scores, rounds appear here with every
            league-mate&apos;s pick.
          </Text>
        ) : null}

        <View style={{ gap: 10 }}>
          {fixtures.map((f) => (
            <FixtureCard
              key={f.id}
              fixture={f}
              viewerUserId={user?.id}
              editable={false}
              home=""
              away=""
              isBanker={false}
              saving={false}
              onChangeHome={() => {}}
              onChangeAway={() => {}}
              onToggleBanker={() => {}}
              onSave={() => {}}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
