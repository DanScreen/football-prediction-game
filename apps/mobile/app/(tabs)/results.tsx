import { useMemo } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native"
import { FixtureCard } from "@/components/FixtureCard"
import { RoundGroup } from "@/components/RoundGroup"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import { fetchFixtures, type MobileFixture } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { groupByRound } from "@/lib/groupByRound"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

/** Matches the web's `/results`: settled rounds, newest first, capped. */
const MAX_ROUNDS = 12

export default function ResultsScreen() {
  const { user } = useAuth()
  const t = useTokens()
  const { data, error, loading, refreshing, reload } = useAsyncData(
    () => fetchFixtures("completed"),
    [],
  )

  const rounds = useMemo(() => groupByRound(data ?? []).slice(0, MAX_ROUNDS), [data])

  function renderFixture(f: MobileFixture) {
    return (
      <FixtureCard
        key={f.id}
        fixture={f}
        viewerUserId={user?.id}
        editable={false}
        hideRoundMeta
        home=""
        away=""
        isBanker={false}
        saving={false}
        justSaved={false}
        saveError={null}
        onChangeHome={() => {}}
        onChangeAway={() => {}}
        onToggleBanker={() => {}}
        onBlurScores={() => {}}
      />
    )
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={screenPadding.pad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload(true)}
            tintColor={t.pitch}
          />
        }
      >
        <Text style={{ fontSize: 15, color: t.inkMuted, marginBottom: 12 }}>
          Settled fixtures with everyone&apos;s picks
        </Text>
        <ErrorBanner message={error} />

        {loading && !data ? <ActivityIndicator color={t.pitch} /> : null}

        {!loading && rounds.length === 0 ? (
          <Text style={{ color: t.inkMuted, lineHeight: 22 }}>
            No settled results yet. Once a host confirms scores, rounds appear here with every
            league-mate&apos;s pick.
          </Text>
        ) : null}

        <View style={{ gap: 14 }}>
          {rounds.map((group, i) => (
            <RoundGroup key={group.key} group={group} defaultOpen={i === 0}>
              {group.fixtures.map(renderFixture)}
            </RoundGroup>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
