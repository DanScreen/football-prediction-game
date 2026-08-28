import { useEffect, useState } from "react"
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from "react-native"
import { ApiError, fetchRules } from "@/lib/api"
import { API_BASE_URL } from "@/lib/config"
import { useTokens } from "@/lib/theme"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"

export default function RulesScreen() {
  const t = useTokens()
  const [error, setError] = useState<string | null>(null)
  const [rules, setRules] = useState<Awaited<ReturnType<typeof fetchRules>> | null>(null)
  const rulesUrl = `${API_BASE_URL}/rules`

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchRules()
        if (!cancelled) setRules(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not load rules.")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Screen>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={screenPadding.scrollContent}>
        <ErrorBanner message={error} />
        {!rules && !error ? <ActivityIndicator color={t.pitch} /> : null}
        {rules ? (
          <View
            style={{
              backgroundColor: t.surface,
              borderColor: t.line,
              borderWidth: 1,
              borderRadius: 12,
              padding: 20,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "700", color: t.ink }}>How points work</Text>
            <Text style={{ color: t.inkMid, lineHeight: 22 }}>
              Exact score · {rules.exact} pts{"\n"}
              Close (right result, within one goal) · {rules.close} pts{"\n"}
              Correct result only · {rules.correctResult} pts{"\n"}
              Banker multiplies that fixture by ×{rules.bankerMultiplier}
            </Text>
            <Text style={{ fontSize: 15, fontWeight: "700", color: t.ink }}>Streak bonus</Text>
            {rules.streakTiers.map((tier) => (
              <Text key={tier.minCorrect} style={{ color: t.inkMid }}>
                {tier.minCorrect}+ correct results in a gameweek · +{tier.points}
              </Text>
            ))}
          </View>
        ) : null}

        <Pressable onPress={() => void Linking.openURL(rulesUrl)} style={{ paddingVertical: 8 }}>
          <Text style={{ color: t.pitch, fontWeight: "700", fontSize: 15 }}>
            Full rules on the website →
          </Text>
          <Text style={{ color: t.inkFaint, fontSize: 12, marginTop: 4 }}>{rulesUrl}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  )
}
