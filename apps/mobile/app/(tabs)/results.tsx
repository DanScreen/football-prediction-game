import { useMemo } from "react"
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native"
import { FixtureCard } from "@/components/FixtureCard"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import { formatPoints, scoreDigits } from "@/components/scoreboard"
import { fetchBonuses, fetchFixtures, type MobileFixture } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { groupByRound, sortRoundsNewestFirst } from "@/lib/groupByRound"
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
  // Bonuses ride alongside rather than inside the fixtures payload — see the
  // comment on the `/bonuses` route. A failure here shouldn't blank the page,
  // so its error is swallowed and the subtotals simply omit the bonus.
  const bonuses = useAsyncData(() => fetchBonuses(), [])

  const bonusByRound = useMemo(() => {
    const map = new Map<string, number>()
    for (const b of bonuses.data ?? []) {
      map.set(`${b.competitionId}·${b.round}`, b.points)
    }
    return map
  }, [bonuses.data])

  const rounds = useMemo(() => {
    // A fixture nobody in your leagues predicted has nothing to show, exactly
    // as on the web, where the query filters them out server-side.
    const withPicks = (data ?? []).filter((f) => f.peerPredictions.length > 0)
    return sortRoundsNewestFirst(groupByRound(withPicks))
      .slice(0, MAX_ROUNDS)
      .map((r) => {
        const mine = r.fixtures.filter((f) => f.prediction)
        const scored = mine.reduce(
          (sum, f) =>
            sum + (f.prediction?.pointsAwarded ?? f.prediction?.provisionalPoints ?? 0),
          0,
        )
        const bonus = bonusByRound.get(r.key) ?? 0
        return {
          ...r,
          // Newest fixture first within the round, like the web page.
          fixtures: [...r.fixtures].sort(
            (a, b) => new Date(b.kickoffTime).getTime() - new Date(a.kickoffTime).getTime(),
          ),
          bonus,
          subtotal: scored + bonus,
          myPickCount: mine.length,
        }
      })
  }, [data, bonusByRound])

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
            onRefresh={() => {
              void reload(true)
              void bonuses.reload(true)
            }}
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

        {/* Flat, always-open sections — the web page has no accordion, and on a
            phone a collapsed round hid the results people came to read. */}
        <View style={{ gap: 24 }}>
          {rounds.map((r) => (
            <View key={r.key} style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  paddingHorizontal: 2,
                }}
              >
                <Text
                  style={{
                    flexShrink: 1,
                    fontSize: 12,
                    fontWeight: "700",
                    color: t.inkMid,
                    letterSpacing: 0.6,
                    textTransform: "uppercase",
                  }}
                  numberOfLines={2}
                >
                  {r.competitionName} · {r.round}
                </Text>
                {r.myPickCount > 0 ? (
                  <Text style={{ fontSize: 13, color: t.inkMuted }}>
                    {r.bonus > 0 ? (
                      <Text style={{ color: t.clock, fontWeight: "600" }}>
                        🔥 +{r.bonus}{"  "}
                      </Text>
                    ) : null}
                    <Text style={{ color: t.ink, fontWeight: "700", ...scoreDigits }}>
                      {formatPoints(r.subtotal)}
                    </Text>
                    <Text> pts</Text>
                    <Text style={{ color: t.inkFaint }}> · you</Text>
                  </Text>
                ) : null}
              </View>

              <View style={{ gap: 10 }}>{r.fixtures.map(renderFixture)}</View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  )
}
