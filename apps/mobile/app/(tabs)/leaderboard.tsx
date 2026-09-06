import { useEffect, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native"
import { formatPoints, scoreDigits } from "@/components/scoreboard"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import {
  ApiError,
  fetchLeaderboards,
  fetchRoundLeaderboard,
  type FormCell,
  type FormTier,
  type LeaderboardBlock,
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
          <LeagueBoard key={block.leagueId} block={block} youId={user?.id} />
        ))}
      </ScrollView>
    </Screen>
  )
}

/**
 * One league's board, with its own Overall/Gameweek state — the toggle belongs
 * to the league, not the screen, so opening gameweek 3 of one league does not
 * silently re-point every other board on the tab.
 */
function LeagueBoard({ block, youId }: { block: LeaderboardBlock; youId?: string }) {
  const t = useTokens()
  const [mode, setMode] = useState<"overall" | "round">("overall")
  // Index into `playedRounds`, which is newest first — so 0 is the current
  // gameweek and cycling back means walking up the array.
  const [roundIndex, setRoundIndex] = useState(0)
  const [roundCache, setRoundCache] = useState<Record<string, LeaderboardEntry[]>>({})
  const [roundError, setRoundError] = useState<string | null>(null)
  const [roundLoading, setRoundLoading] = useState(false)

  // A server older than the gameweek endpoints omits this entirely, so the tab
  // falls back to the overall table instead of throwing on undefined.
  const playedRounds = block.playedRounds ?? []
  const round: string | null = playedRounds[roundIndex] ?? null
  const cached = round ? roundCache[round] : undefined

  useEffect(() => {
    if (mode !== "round" || !round || cached) return
    let cancelled = false
    setRoundLoading(true)
    setRoundError(null)
    fetchRoundLeaderboard(block.leagueId, round)
      .then((res) => {
        // Cached by round name so cycling back and forth costs one request per
        // gameweek, not one per press.
        if (!cancelled) setRoundCache((prev) => ({ ...prev, [res.round]: res.standings }))
      })
      .catch((err) => {
        if (!cancelled) {
          setRoundError(err instanceof ApiError ? err.message : "Could not load that gameweek.")
        }
      })
      .finally(() => {
        if (!cancelled) setRoundLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, round, cached, block.leagueId])

  const standings = mode === "overall" ? block.standings : (cached ?? [])
  const showForm = mode === "overall" && block.formRounds.length > 0

  return (
    <View style={{ gap: 0, marginBottom: 12 }}>
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
        <Text style={{ color: t.boardGold, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>
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
        {/* No picker before a competition kicks off: there is no gameweek to
            show, and an empty one reads as a bug. */}
        {playedRounds.length > 0 ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              backgroundColor: t.chip,
              borderBottomWidth: 1,
              borderBottomColor: t.lineSoft,
            }}
          >
            <View style={{ flexDirection: "row", gap: 2 }}>
              <ModeTab label="Overall" active={mode === "overall"} onPress={() => setMode("overall")} />
              <ModeTab label="Gameweek" active={mode === "round"} onPress={() => setMode("round")} />
            </View>

            {mode === "round" && round ? (
              <RoundStepper
                round={round}
                // Newest first, so "older" is a higher index.
                onOlder={
                  roundIndex < playedRounds.length - 1
                    ? () => setRoundIndex((i) => i + 1)
                    : null
                }
                onNewer={roundIndex > 0 ? () => setRoundIndex((i) => i - 1) : null}
              />
            ) : null}
          </View>
        ) : null}

        {mode === "round" && roundLoading && !cached ? (
          <View style={{ padding: 24, alignItems: "center", backgroundColor: t.surface }}>
            <ActivityIndicator color={t.pitch} />
          </View>
        ) : null}

        {mode === "round" && roundError ? (
          <View style={{ padding: 16, backgroundColor: t.surface }}>
            <Text style={{ color: t.bad, fontSize: 13 }}>{roundError}</Text>
          </View>
        ) : null}

        {standings.map((row, i) => (
          <StandingRow
            key={row.id}
            row={row}
            index={i}
            isYou={row.id === youId}
            last={i === standings.length - 1}
          />
        ))}

        {standings.length === 0 && !roundLoading && !roundError ? (
          <View style={{ padding: 24, alignItems: "center", backgroundColor: t.surface }}>
            <Text style={{ fontSize: 28, marginBottom: 6 }}>🏆</Text>
            {/* A round table lists every member on zero rather than nobody, so
                this is the empty-league case in both modes. */}
            <Text style={{ color: t.inkMuted }}>No players yet.</Text>
          </View>
        ) : null}
      </View>

      {showForm ? <FormLegend /> : null}
    </View>
  )
}

function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  const t = useTokens()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: active ? t.surface : "transparent",
        borderWidth: 1,
        borderColor: active ? t.line : "transparent",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 12,
          fontWeight: "700",
          color: active ? t.ink : t.inkMuted,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

/**
 * Back/forward through the gameweeks. A null handler means the end of the
 * range: the arrow stays in place, dimmed, rather than disappearing and
 * shifting the round name under the player's thumb.
 */
function RoundStepper({
  round,
  onOlder,
  onNewer,
}: {
  round: string
  onOlder: (() => void) | null
  onNewer: (() => void) | null
}) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <StepArrow glyph="‹" label="Previous gameweek" onPress={onOlder} />
      <Text
        style={{ fontSize: 12, fontWeight: "700", color: t.ink, minWidth: 64, textAlign: "center" }}
        numberOfLines={1}
      >
        {round}
      </Text>
      <StepArrow glyph="›" label="Next gameweek" onPress={onNewer} />
    </View>
  )
}

function StepArrow({
  glyph,
  label,
  onPress,
}: {
  glyph: string
  label: string
  onPress: (() => void) | null
}) {
  const t = useTokens()
  return (
    <Pressable
      onPress={onPress ?? undefined}
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      style={({ pressed }) => ({
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: t.surface,
        borderWidth: 1,
        borderColor: t.line,
        opacity: !onPress ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ fontSize: 16, lineHeight: 18, color: t.ink }}>{glyph}</Text>
    </Pressable>
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
