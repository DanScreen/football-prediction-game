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
import { podiumRank } from "@/lib/podium"
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
  // Not amber like the banker: the two sit side by side in the stacked bar.
  { key: "streak", short: "streak", tone: (t) => t.pitch },
]

type BreakdownPart = (typeof BREAKDOWN)[number] & { value: number }

/**
 * Form cells are drawn as bars: height carries how much each round scored,
 * colour carries the tier. The label stays on each cell for screen readers.
 */
const FORM_TIERS: Record<FormTier, { label: string; fg: (t: Tokens) => string }> = {
  strong: { label: "Strong", fg: (t) => t.good },
  mixed: { label: "Mixed", fg: (t) => t.clock },
  poor: { label: "Poor", fg: (t) => t.bad },
  none: { label: "No picks", fg: (t) => t.inkFaint },
}

const PODIUM_LABELS: Record<1 | 2 | 3, string> = { 1: "1ST", 2: "2ND", 3: "3RD" }

function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
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
  // Only one row is open at a time. The viewer's own row starts open.
  const [expandedId, setExpandedId] = useState<string | null>(youId ?? null)

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
  const showPodium = standings.length >= 3 && standings[0].totalPoints > 0

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

        {showPodium ? <Podium standings={standings} /> : null}

        {standings.map((row, i) => (
          <StandingRow
            key={row.id}
            row={row}
            isYou={row.id === youId}
            showForm={showForm}
            expanded={expandedId === row.id}
            onToggle={() => setExpandedId((cur) => (cur === row.id ? null : row.id))}
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

/**
 * The top three as a podium, left → right 2nd, 1st, 3rd so the leader sits on
 * the tallest step. The rows below repeat the same data, so this is hidden from
 * assistive tech rather than read out twice.
 */
function Podium({ standings }: { standings: LeaderboardEntry[] }) {
  const t = useTokens()
  const columns: Array<{ row: LeaderboardEntry; position: 1 | 2 | 3; paddingBottom: number }> = [
    { row: standings[1], position: 2, paddingBottom: 18 },
    { row: standings[0], position: 1, paddingBottom: 30 },
    { row: standings[2], position: 3, paddingBottom: 10 },
  ]

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 6,
        paddingHorizontal: 14,
        paddingTop: 12,
        backgroundColor: t.surface,
        borderBottomWidth: 1,
        borderBottomColor: t.lineSoft,
      }}
    >
      {columns.map(({ row, position, paddingBottom }) => {
        // Ties share a place: two players level on the top points both read "1ST".
        const place = (podiumRank(row) || position) as 1 | 2 | 3
        return (
          <View
            key={position}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: "center",
              gap: 1,
              borderTopLeftRadius: 9,
              borderTopRightRadius: 9,
              paddingTop: 8,
              paddingHorizontal: 4,
              paddingBottom,
              backgroundColor: position === 1 ? t.boardPanel : t.board,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: "700", letterSpacing: 1, color: t.boardGold }}>
              {PODIUM_LABELS[place]}
            </Text>
            <Text
              style={{ fontSize: 13, fontWeight: "700", color: t.boardFore }}
              numberOfLines={1}
            >
              {row.displayName}
            </Text>
            <Text style={{ fontSize: 17, fontWeight: "700", color: t.boardFore, ...scoreDigits }}>
              {formatPoints(row.totalPoints)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

function StandingRow({
  row,
  isYou,
  showForm,
  expanded,
  onToggle,
  last,
}: {
  row: LeaderboardEntry
  isYou: boolean
  showForm: boolean
  expanded: boolean
  onToggle: () => void
  last: boolean
}) {
  const t = useTokens()
  const parts: BreakdownPart[] = BREAKDOWN.flatMap((col) => {
    const value = row.pointsBreakdown[col.key]
    return value > 0 ? [{ ...col, value }] : []
  })

  return (
    <View
      style={{
        backgroundColor: isYou ? t.pitchTint : t.surface,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.lineSoft,
      }}
    >
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Shows the points breakdown"
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ width: 22, fontWeight: "700", color: t.inkMuted, fontSize: 14, ...scoreDigits }}>
          {row.rank}
        </Text>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1}>
            <Text style={{ fontWeight: "700", color: t.ink }}>{row.displayName}</Text>
            {row.isBot ? (
              <Text style={{ fontSize: 10, fontWeight: "700", color: t.inkFaint, letterSpacing: 0.6 }}>
                {" "}BOT
              </Text>
            ) : null}
            {isYou ? (
              <Text style={{ color: t.pitch, fontSize: 12, fontWeight: "600" }}> (you)</Text>
            ) : null}
          </Text>
        </View>

        {showForm && row.form.length > 0 ? <FormStrip form={row.form} /> : null}

        <View style={{ alignItems: "flex-end", minWidth: 48 }}>
          <Text style={{ fontWeight: "700", color: t.ink, fontSize: 16, ...scoreDigits }}>
            {formatPoints(row.totalPoints)}
            {row.provisionalPoints > 0 ? (
              <Text style={{ color: t.clock, fontSize: 12, fontWeight: "700" }}>
                {" "}
                +{formatPoints(row.provisionalPoints)}
              </Text>
            ) : null}
          </Text>
        </View>
      </Pressable>

      {expanded ? <BreakdownDetail row={row} parts={parts} /> : null}
    </View>
  )
}

/**
 * The points breakdown behind a collapsed row: a stacked bar showing each
 * bucket's share, a legend with the points, and the exact-score count. The
 * count is spelled out as "exact scores" so it cannot be mistaken for exact
 * points.
 */
function BreakdownDetail({ row, parts }: { row: LeaderboardEntry; parts: BreakdownPart[] }) {
  const t = useTokens()
  return (
    <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 6 }}>
      <View
        style={{
          flexDirection: "row",
          height: 8,
          borderRadius: 4,
          overflow: "hidden",
          backgroundColor: t.chip,
        }}
      >
        {parts.map((p) => (
          <View key={p.key} style={{ flex: p.value, backgroundColor: p.tone(t) }} />
        ))}
      </View>

      {parts.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 2 }}>
          {parts.map((p) => (
            <View key={p.key} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
              <View style={{ width: 7, height: 7, borderRadius: 2, backgroundColor: p.tone(t) }} />
              <Text style={{ fontSize: 11, color: t.inkMid }}>
                {capitalise(p.short)}{" "}
                <Text style={{ fontWeight: "700", ...scoreDigits }}>{formatPoints(p.value)}</Text>
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 12, color: t.inkFaint }}>No points yet.</Text>
      )}

      {row.exactCount > 0 ? (
        <Text style={{ fontSize: 11, color: t.inkMuted }}>
          {row.exactCount} exact score{row.exactCount === 1 ? "" : "s"}
        </Text>
      ) : null}
    </View>
  )
}

/**
 * One bar per gameweek, oldest → newest. Height is how much that round scored,
 * relative to the player's best round; a round with no picks is a short stub.
 */
function FormStrip({ form }: { form: FormCell[] }) {
  const t = useTokens()
  const top = Math.max(0, ...form.map((cell) => cell.scored))
  const max = top > 0 ? top : 1
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 20 }}>
      {form.map((cell) => {
        const tier = FORM_TIERS[cell.tier]
        const none = cell.tier === "none"
        return (
          <View
            key={cell.round}
            accessibilityLabel={
              none
                ? `${cell.round}: no predictions`
                : `${cell.round}: ${formatPoints(cell.scored)} points, ${tier.label.toLowerCase()}`
            }
            style={{
              width: 6,
              height: none ? 3 : 4 + Math.round(16 * (cell.scored / max)),
              borderRadius: 2,
              backgroundColor: none ? t.lineStrong : tier.fg(t),
            }}
          />
        )
      })}
    </View>
  )
}
