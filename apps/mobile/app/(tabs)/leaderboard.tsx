import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native"
import { formatPoints, scoreDigits } from "@/components/scoreboard"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import {
  fetchLeaderboards,
  type FormCell,
  type FormTier,
  type LeaderboardEntry,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"
import type { Tokens } from "@/constants/tokens"
import { useAsyncData } from "@/lib/useAsyncData"

/**
 * Where a player's points came from — the same five buckets, tones and wording
 * as the web's `BREAKDOWN_COLUMNS`. They sum to the total, so a row accounts for
 * itself. Banker is the *extra* the doubling produced, not the whole fixture.
 */
const BREAKDOWN: Array<{
  key: keyof LeaderboardEntry["pointsBreakdown"]
  short: string
  tone: (t: Tokens) => string
}> = [
  { key: "result", short: "result", tone: (t) => t.inkMuted },
  { key: "close", short: "close", tone: (t) => t.info },
  { key: "exact", short: "exact", tone: (t) => t.good },
  { key: "banker", short: "banker", tone: (t) => t.clock },
  { key: "streak", short: "streak", tone: (t) => t.clock },
]

/**
 * Form cells are dual-encoded — glyph as well as colour — because colour alone
 * left colour-blind players unable to read their own form, and there is no
 * hover tooltip to fall back on when the surface is a touchscreen.
 */
const FORM_TIERS: Record<
  FormTier,
  { glyph: string; label: string; fg: (t: Tokens) => string; bg: (t: Tokens) => string; line: (t: Tokens) => string }
> = {
  strong: { glyph: "▲", label: "Strong", fg: (t) => t.good, bg: (t) => t.goodTint, line: (t) => t.goodLine },
  mixed: { glyph: "■", label: "Mixed", fg: (t) => t.clock, bg: (t) => t.clockTint, line: (t) => t.clockLine },
  poor: { glyph: "▼", label: "Poor", fg: (t) => t.bad, bg: (t) => t.badTint, line: (t) => t.badLine },
  none: { glyph: "·", label: "No picks", fg: (t) => t.inkFaint, bg: (t) => t.chip, line: (t) => t.line },
}

export default function LeaderboardScreen() {
  const { user } = useAuth()
  const t = useTokens()
  const { data, error, loading, refreshing, reload } = useAsyncData(() => fetchLeaderboards(), [])

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={screenPadding.scrollContent}
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
          <View key={block.leagueId} style={{ gap: 0, marginBottom: 12 }}>
            {/* The deep-green board panel is the web's table header, which is
                where the scoreboard palette earns its keep. */}
            <View
              style={{
                backgroundColor: t.board,
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: t.boardFore, fontWeight: "700", fontSize: 16 }} numberOfLines={1}>
                  {block.leagueName}
                </Text>
                <Text style={{ color: t.boardMuted, marginTop: 2, fontSize: 12 }} numberOfLines={1}>
                  {block.competitionName} · {block.standings.length} player
                  {block.standings.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <Text
                style={{
                  color: t.boardGold,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 0.8,
                }}
              >
                POINTS
              </Text>
            </View>

            <View
              style={{
                borderColor: t.line,
                borderWidth: 1,
                borderTopWidth: 0,
                borderBottomLeftRadius: 12,
                borderBottomRightRadius: 12,
                overflow: "hidden",
              }}
            >
              {block.standings.map((row, i) => (
                <StandingRow
                  key={row.id}
                  row={row}
                  index={i}
                  isYou={row.id === user?.id}
                  last={i === block.standings.length - 1}
                />
              ))}
              {block.standings.length === 0 ? (
                <View style={{ padding: 24, alignItems: "center", backgroundColor: t.surface }}>
                  <Text style={{ fontSize: 28, marginBottom: 6 }}>🏆</Text>
                  <Text style={{ color: t.inkMuted }}>No players yet.</Text>
                </View>
              ) : null}
            </View>

            {block.formRounds.length > 0 ? <FormLegend /> : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  )
}

function StandingRow({
  row,
  index,
  isYou,
  last,
}: {
  row: LeaderboardEntry
  index: number
  isYou: boolean
  last: boolean
}) {
  const t = useTokens()
  const chips = BREAKDOWN.filter((col) => row.pointsBreakdown[col.key] > 0)

  // Podium rows fade from a gold-ish tint down to the plain surface, matching
  // the web's `rowBg` ramp. Everything else sits on the surface token.
  const bg = index === 0 ? t.clockTint : index === 1 ? t.chip : t.surface

  return (
    <View
      style={{
        backgroundColor: bg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.lineSoft,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Text
          style={{ width: 26, fontWeight: "700", color: t.inkMuted, fontSize: 15, ...scoreDigits }}
        >
          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : row.rank}
        </Text>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1}>
            <Text style={{ fontWeight: "700", color: t.ink }}>{row.displayName}</Text>
            {row.isBot ? <Text style={{ color: t.inkFaint, fontSize: 12 }}> 🤖</Text> : null}
            {isYou ? (
              <Text style={{ color: t.pitch, fontSize: 12, fontWeight: "600" }}> (you)</Text>
            ) : null}
          </Text>

          {chips.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 8, marginTop: 2 }}>
              {chips.map((col) => (
                <Text key={col.key} style={{ fontSize: 11, color: col.tone(t) }}>
                  <Text style={{ fontWeight: "700", ...scoreDigits }}>
                    {formatPoints(row.pointsBreakdown[col.key])}
                  </Text>{" "}
                  {col.short}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ alignItems: "flex-end", minWidth: 52 }}>
          <Text style={{ fontWeight: "700", color: t.ink, fontSize: 16, ...scoreDigits }}>
            {formatPoints(row.totalPoints)}
            {row.provisionalPoints > 0 ? (
              <Text style={{ color: t.clock, fontSize: 12, fontWeight: "700" }}>
                {" "}
                +{formatPoints(row.provisionalPoints)}
              </Text>
            ) : null}
          </Text>
          {row.exactCount > 0 ? (
            <Text style={{ color: t.good, fontSize: 11 }}>
              {row.exactCount} exact
            </Text>
          ) : null}
        </View>
      </View>

      {row.form.length > 0 ? <FormStrip form={row.form} /> : null}
    </View>
  )
}

function FormStrip({ form }: { form: FormCell[] }) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 4 }}>
      {form.map((cell) => {
        const tier = FORM_TIERS[cell.tier]
        return (
          <View
            key={cell.round}
            accessibilityLabel={
              cell.tier === "none"
                ? `${cell.round}: no predictions`
                : `${cell.round}: ${formatPoints(cell.scored)} points, ${tier.label.toLowerCase()}`
            }
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: tier.line(t),
              backgroundColor: tier.bg(t),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 9, color: tier.fg(t) }}>{tier.glyph}</Text>
          </View>
        )
      })}
    </View>
  )
}

function FormLegend() {
  const t = useTokens()
  const items: Array<[FormTier, string]> = [
    ["strong", ">40% of pts"],
    ["mixed", "21–40%"],
    ["poor", "≤20%"],
    ["none", "No picks"],
  ]
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        columnGap: 12,
        rowGap: 4,
        marginTop: 8,
        paddingHorizontal: 2,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.inkMid }}>
        Form key <Text style={{ fontWeight: "400" }}>(oldest → newest)</Text>:
      </Text>
      {items.map(([tier, label]) => {
        const spec = FORM_TIERS[tier]
        return (
          <View key={tier} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 3,
                borderWidth: 1,
                borderColor: spec.line(t),
                backgroundColor: spec.bg(t),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 8, color: spec.fg(t) }}>{spec.glyph}</Text>
            </View>
            <Text style={{ fontSize: 11, color: t.inkMuted }}>{label}</Text>
          </View>
        )
      })}
    </View>
  )
}
