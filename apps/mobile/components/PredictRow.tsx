import { Pressable, Text, View } from "react-native"
import { Countdown, scoreDigits } from "@/components/scoreboard"
import { TeamChip } from "@/components/TeamChip"
import type { MobileFixture } from "@/lib/api"
import { useTokens } from "@/lib/theme"

const COUNTDOWN_WINDOW_MS = 24 * 60 * 60 * 1000

function formatKickoff(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseScore(raw: string): number | null {
  if (raw === "") return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

/** One compact card per fixture: kickoff + status, banker toggle, two steppers. */
export function PredictRow({
  fixture,
  home,
  away,
  isBanker,
  onStep,
  onToggleBanker,
  saving,
  justSaved,
  saveError,
}: {
  fixture: MobileFixture
  /** Draft score, "" when empty. */
  home: string
  away: string
  isBanker: boolean
  onStep: (side: "home" | "away", delta: 1 | -1) => void
  onToggleBanker: () => void
  saving: boolean
  justSaved: boolean
  saveError: string | null
}) {
  const t = useTokens()
  const pred = fixture.prediction

  const homeScore = parseScore(home)
  const awayScore = parseScore(away)
  const bothValid = homeScore !== null && awayScore !== null
  const matchesSaved =
    pred != null && homeScore === pred.homeScore && awayScore === pred.awayScore
  const showSavedStyle = bothValid && (matchesSaved || saving || justSaved)
  const hasPrediction = pred != null || (justSaved && bothValid)

  const msUntilKickoff = new Date(fixture.kickoffTime).getTime() - Date.now()
  const showCountdown = msUntilKickoff < COUNTDOWN_WINDOW_MS

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderColor: hasPrediction ? t.line : t.clockLine,
        borderStyle: hasPrediction ? "solid" : "dashed",
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        gap: 8,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ flex: 1, fontSize: 12, color: t.inkFaint }} numberOfLines={1}>
          {formatKickoff(fixture.kickoffTime)}
        </Text>
        <Text style={{ fontSize: 12 }}>
          {saveError ? (
            <Text style={{ color: t.bad, fontWeight: "600" }}>{saveError}</Text>
          ) : saving ? (
            <Text style={{ color: t.inkMuted, fontWeight: "600" }}>Saving…</Text>
          ) : justSaved ? (
            <Text style={{ color: t.pitch, fontWeight: "700" }}>✓ Saved</Text>
          ) : null}
        </Text>
        {showCountdown ? <Countdown kickoffTime={fixture.kickoffTime} /> : null}
        <Pressable
          onPress={onToggleBanker}
          disabled={!hasPrediction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Banker — points doubled"
          accessibilityState={{ selected: isBanker, disabled: !hasPrediction }}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: isBanker ? t.clock : t.line,
            backgroundColor: isBanker ? t.clock : t.chip,
            opacity: hasPrediction ? 1 : 0.45,
          }}
        >
          <Text
            style={{
              fontSize: 12,
              fontWeight: "700",
              color: isBanker ? t.clockOn : t.inkMuted,
            }}
          >
            {isBanker ? "★ Banker ×2" : "☆ Banker"}
          </Text>
        </Pressable>
      </View>

      <TeamRow
        team={fixture.homeTeam}
        value={home}
        saved={showSavedStyle}
        onMinus={() => onStep("home", -1)}
        onPlus={() => onStep("home", 1)}
      />
      <TeamRow
        team={fixture.awayTeam}
        value={away}
        saved={showSavedStyle}
        onMinus={() => onStep("away", -1)}
        onPlus={() => onStep("away", 1)}
      />

    </View>
  )
}

function TeamRow({
  team,
  value,
  saved,
  onMinus,
  onPlus,
}: {
  team: string
  value: string
  saved: boolean
  onMinus: () => void
  onPlus: () => void
}) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <TeamChip team={team} />
      <Text
        style={{ flex: 1, fontSize: 15, fontWeight: "600", color: t.ink }}
        numberOfLines={1}
      >
        {team}
      </Text>
      <Stepper
        team={team}
        value={value}
        saved={saved}
        onMinus={onMinus}
        onPlus={onPlus}
      />
    </View>
  )
}

function Stepper({
  team,
  value,
  saved,
  onMinus,
  onPlus,
}: {
  team: string
  value: string
  saved: boolean
  onMinus: () => void
  onPlus: () => void
}) {
  const t = useTokens()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <StepButton label={`${team} one fewer`} glyph="−" onPress={onMinus} />
      <Text
        accessibilityLabel={`${team} score ${value === "" ? "not set" : value}`}
        style={{
          width: 30,
          textAlign: "center",
          fontSize: 20,
          fontWeight: "700",
          color: value === "" ? t.inkFaint : saved ? t.pitch : t.ink,
          ...scoreDigits,
        }}
      >
        {value === "" ? "·" : value}
      </Text>
      <StepButton label={`${team} one more`} glyph="+" onPress={onPlus} />
    </View>
  )
}

function StepButton({
  label,
  glyph,
  onPress,
}: {
  label: string
  glyph: string
  onPress: () => void
}) {
  const t = useTokens()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: t.lineStrong,
        backgroundColor: t.chip,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: t.inkMid,
          lineHeight: 22,
          textAlign: "center",
        }}
      >
        {glyph}
      </Text>
    </Pressable>
  )
}
