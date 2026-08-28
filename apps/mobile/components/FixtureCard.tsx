import { Pressable, Text, TextInput, View } from "react-native"
import {
  BankerTag,
  Countdown,
  NailedIt,
  PointsBadge,
  formatPoints,
  scoreDigits,
} from "@/components/scoreboard"
import { useTokens } from "@/lib/theme"
import type { MobileFixture } from "@/lib/api"

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

/**
 * What the pick scored *before* the banker doubled it. The colour of the points
 * badge and the "Nailed it!" flag key off which outcome it was (exact / close /
 * result), so a doubled 3 must not be mistaken for an ordinary 6 — the same
 * reasoning as `awardedScoreOf` in the web's `PredictionHistory`.
 */
function baseTone(points: number, isBanker: boolean): number {
  return isBanker ? points / 2 : points
}

export function FixtureCard({
  fixture,
  home,
  away,
  isBanker,
  onChangeHome,
  onChangeAway,
  onToggleBanker,
  onSave,
  saving,
  editable,
  /** When true, hide competition/round (shown on the round header instead). */
  hideRoundMeta = false,
}: {
  fixture: MobileFixture
  home: string
  away: string
  isBanker: boolean
  onChangeHome: (v: string) => void
  onChangeAway: (v: string) => void
  onToggleBanker: () => void
  onSave: () => void
  saving: boolean
  editable: boolean
  hideRoundMeta?: boolean
}) {
  const t = useTokens()
  const pred = fixture.prediction
  const settled = fixture.actualHomeScore != null && fixture.actualAwayScore != null
  const hasProv =
    fixture.provisionalHomeScore != null && fixture.provisionalAwayScore != null
  const tone =
    pred?.pointsAwarded != null ? baseTone(pred.pointsAwarded, pred.isBanker) : null

  // The web gives each settled card a coloured left edge so a round reads as a
  // column of outcomes without anyone parsing the numbers. Same rule here.
  const accent =
    tone === 3
      ? t.good
      : tone === 0
        ? t.bad
        : tone !== null
          ? t.info
          : hasProv
            ? t.clock
            : t.lineStrong

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        borderLeftWidth: 4,
        borderLeftColor: accent,
        borderRadius: 12,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text style={{ color: t.inkFaint, fontSize: 12, flex: 1 }} numberOfLines={1}>
          {hideRoundMeta
            ? formatKickoff(fixture.kickoffTime)
            : `${fixture.competitionName} · ${fixture.round} · ${formatKickoff(fixture.kickoffTime)}`}
        </Text>
        {editable ? <Countdown kickoffTime={fixture.kickoffTime} /> : null}
      </View>

      <Text style={{ fontSize: 16, fontWeight: "700", color: t.ink }}>
        {fixture.homeTeam} <Text style={{ color: t.inkFaint, fontWeight: "400" }}>vs</Text>{" "}
        {fixture.awayTeam}
      </Text>

      {editable ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ScoreBox value={home} onChange={onChangeHome} label="Home score" />
            <Text style={{ color: t.inkFaint, fontWeight: "700" }}>–</Text>
            <ScoreBox value={away} onChange={onChangeAway} label="Away score" />
            <Pressable
              onPress={onToggleBanker}
              accessibilityRole="button"
              accessibilityLabel="Banker — points doubled"
              accessibilityState={{ selected: isBanker }}
              style={{
                marginLeft: "auto",
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isBanker ? t.clock : t.line,
                backgroundColor: isBanker ? t.clock : t.chip,
              }}
            >
              <Text
                style={{
                  color: isBanker ? t.clockOn : t.inkMuted,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                ★ ×2
              </Text>
            </Pressable>
          </View>

          <Pressable
            onPress={onSave}
            disabled={saving}
            style={({ pressed }) => ({
              backgroundColor: pressed ? t.pitchDeep : t.pitch,
              borderRadius: 8,
              paddingVertical: 10,
              alignItems: "center",
              opacity: saving ? 0.7 : 1,
            })}
          >
            <Text style={{ color: t.pitchOn, fontWeight: "700" }}>
              {saving ? "Saving…" : pred ? "Update pick" : "Save pick"}
            </Text>
          </Pressable>
        </>
      ) : (
        /* Settled / kicked-off picks read as the web's three columns:
           My pick · Result · Pts. */
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 20 }}>
          <Column label="My pick">
            <Text style={{ fontSize: 18, fontWeight: "700", color: t.ink, ...scoreDigits }}>
              {pred ? `${pred.homeScore} – ${pred.awayScore}` : "—"}
            </Text>
            {pred?.isBanker ? (
              <View style={{ marginTop: 4 }}>
                <BankerTag />
              </View>
            ) : null}
          </Column>

          <Column label="Result">
            {settled ? (
              <Text style={{ fontSize: 18, fontWeight: "700", color: t.ink, ...scoreDigits }}>
                {fixture.actualHomeScore} – {fixture.actualAwayScore}
              </Text>
            ) : hasProv ? (
              <>
                <Text style={{ fontSize: 18, fontWeight: "700", color: t.clock, ...scoreDigits }}>
                  {fixture.provisionalHomeScore} – {fixture.provisionalAwayScore}
                </Text>
                <Text
                  style={{
                    color: t.clock,
                    fontSize: 10,
                    fontWeight: "700",
                    letterSpacing: 0.6,
                  }}
                >
                  PROVISIONAL
                </Text>
              </>
            ) : (
              <Text style={{ color: t.inkFaint, fontStyle: "italic" }}>Pending</Text>
            )}
          </Column>

          <Column label="Pts">
            {tone !== null && pred?.pointsAwarded != null ? (
              <View style={{ gap: 4, alignItems: "flex-start" }}>
                <PointsBadge points={pred.pointsAwarded} tone={tone} />
                {tone === 3 ? <NailedIt /> : null}
              </View>
            ) : pred?.provisionalPoints != null ? (
              <Text style={{ color: t.clock, fontWeight: "700", ...scoreDigits }}>
                {formatPoints(pred.provisionalPoints)} prov.
              </Text>
            ) : (
              <Text style={{ color: t.inkFaint }}>–</Text>
            )}
          </Column>
        </View>
      )}
    </View>
  )
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useTokens()
  return (
    <View style={{ gap: 2, minWidth: 56 }}>
      <Text style={{ color: t.inkFaint, fontSize: 11 }}>{label}</Text>
      {children}
    </View>
  )
}

function ScoreBox({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label: string
}) {
  const t = useTokens()
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/[^0-9]/g, "").slice(0, 2))}
      keyboardType="number-pad"
      placeholder="·"
      placeholderTextColor={t.inkFaint}
      accessibilityLabel={label}
      style={{
        width: 48,
        textAlign: "center",
        fontSize: 20,
        fontWeight: "700",
        borderWidth: 1,
        borderColor: t.lineStrong,
        borderRadius: 8,
        paddingVertical: 8,
        color: t.ink,
        backgroundColor: t.ground,
        ...scoreDigits,
      }}
    />
  )
}
