import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native"
import {
  BankerTag,
  Countdown,
  NailedIt,
  PointsBadge,
  formatPoints,
  scoreDigits,
} from "@/components/scoreboard"
import { useTokens } from "@/lib/theme"
import type { FixturePrediction, MobileFixture } from "@/lib/api"

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

function formatPick(pred: Pick<FixturePrediction, "homeScore" | "awayScore">): string {
  return `${pred.homeScore} – ${pred.awayScore}`
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

function parseScore(raw: string): number | null {
  if (raw === "") return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

export function FixtureCard({
  fixture,
  viewerUserId,
  home,
  away,
  isBanker,
  onChangeHome,
  onChangeAway,
  onToggleBanker,
  onBlurScores,
  saving,
  justSaved,
  saveError,
  editable,
  /** When true, hide competition/round (shown on the round header instead). */
  hideRoundMeta = false,
}: {
  fixture: MobileFixture
  viewerUserId?: string
  home: string
  away: string
  isBanker: boolean
  onChangeHome: (v: string) => void
  onChangeAway: (v: string) => void
  onToggleBanker: () => void
  /** Flush any pending autosave when a score field blurs. */
  onBlurScores: () => void
  saving: boolean
  justSaved: boolean
  saveError: string | null
  editable: boolean
  hideRoundMeta?: boolean
}) {
  const t = useTokens()
  const pred = fixture.prediction
  const settled = fixture.actualHomeScore != null && fixture.actualAwayScore != null
  const hasProv = fixture.provisionalHomeScore != null && fixture.provisionalAwayScore != null
  const tone = pred?.pointsAwarded != null ? baseTone(pred.pointsAwarded, pred.isBanker) : null

  // Peers arrive viewer-first from the API (`sortPeerPredictions`), so this list
  // reads the same way the web's Results section does: You, then everyone else.
  const peers = editable ? [] : fixture.peerPredictions

  const homeScore = parseScore(home)
  const awayScore = parseScore(away)
  const bothValid = homeScore !== null && awayScore !== null
  const matchesSaved = pred != null && homeScore === pred.homeScore && awayScore === pred.awayScore
  const showSavedStyle = bothValid && (matchesSaved || saving || justSaved)
  const hasPrediction = pred != null || (justSaved && bothValid)

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
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <ScoreBox
              value={home}
              onChange={onChangeHome}
              onBlur={onBlurScores}
              saved={showSavedStyle}
              label="Home score"
            />
            <Text style={{ color: t.inkFaint, fontWeight: "700" }}>–</Text>
            <ScoreBox
              value={away}
              onChange={onChangeAway}
              onBlur={onBlurScores}
              saved={showSavedStyle}
              label="Away score"
            />
            <Pressable
              onPress={onToggleBanker}
              disabled={!hasPrediction}
              accessibilityRole="button"
              accessibilityLabel="Banker — points doubled"
              accessibilityState={{ selected: isBanker, disabled: !hasPrediction }}
              style={{
                marginLeft: "auto",
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isBanker ? t.clock : t.line,
                backgroundColor: isBanker ? t.clock : t.chip,
                opacity: hasPrediction ? 1 : 0.45,
              }}
            >
              <Text
                style={{ color: isBanker ? t.clockOn : t.inkMuted, fontWeight: "700", fontSize: 13 }}
              >
                ★ ×2
              </Text>
            </Pressable>
          </View>

          {/* Fixed-height status slot so the card doesn't jump as saves resolve. */}
          <View style={{ minHeight: 18, justifyContent: "center" }}>
            {saveError ? (
              <Text style={{ color: t.bad, fontSize: 12, fontWeight: "600" }}>{saveError}</Text>
            ) : saving ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <ActivityIndicator size="small" color={t.pitch} />
                <Text style={{ color: t.inkMuted, fontSize: 12, fontWeight: "600" }}>Saving…</Text>
              </View>
            ) : justSaved ? (
              <Text style={{ color: t.pitch, fontSize: 12, fontWeight: "700" }}>✓ Saved</Text>
            ) : !hasPrediction ? (
              <Text style={{ color: t.inkFaint, fontSize: 12 }}>
                Enter both scores — saves automatically
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 20 }}>
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
                    style={{ color: t.clock, fontSize: 10, fontWeight: "700", letterSpacing: 0.6 }}
                  >
                    PROVISIONAL
                  </Text>
                </>
              ) : (
                <Text style={{ color: t.inkFaint, fontStyle: "italic" }}>Pending</Text>
              )}
            </Column>

            <Column label="Your pts">
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

          {/* Everyone's picks, unlocked at kickoff — the reason the tab is worth
              opening once you can no longer change anything. */}
          {peers.length > 0 ? (
            <View style={{ borderTopWidth: 1, borderTopColor: t.lineSoft, paddingTop: 8, gap: 6 }}>
              {peers.map((p) => (
                <PeerRow key={p.userId} peer={p} settled={settled} isYou={p.userId === viewerUserId} />
              ))}
            </View>
          ) : (
            <View style={{ borderTopWidth: 1, borderTopColor: t.lineSoft, paddingTop: 8 }}>
              <Text style={{ color: t.inkFaint, fontSize: 13, fontStyle: "italic" }}>
                {pred ? "No one else in your leagues predicted this one." : "You didn't predict this one."}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

function PeerRow({
  peer,
  settled,
  isYou,
}: {
  peer: FixturePrediction
  settled: boolean
  isYou: boolean
}) {
  const t = useTokens()
  const tone = peer.pointsAwarded != null ? baseTone(peer.pointsAwarded, peer.isBanker) : null

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <Text
        style={{
          width: 96,
          color: isYou ? t.pitch : t.inkMuted,
          fontWeight: isYou ? "700" : "500",
          fontSize: 14,
        }}
        numberOfLines={1}
      >
        {isYou ? "You" : `${peer.isBot ? "🤖 " : ""}${peer.displayName}`}
      </Text>
      <Text
        style={{ fontWeight: "700", color: isYou ? t.ink : t.inkMid, ...scoreDigits }}
      >
        {formatPick(peer)}
      </Text>
      {peer.isBanker ? <BankerTag /> : null}
      {settled && tone !== null && peer.pointsAwarded != null ? (
        <PointsBadge points={peer.pointsAwarded} tone={tone} />
      ) : !settled && peer.provisionalPoints != null ? (
        <Text style={{ color: t.clock, fontWeight: "700", fontSize: 13, ...scoreDigits }}>
          {formatPoints(peer.provisionalPoints)} prov.
        </Text>
      ) : null}
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
  onBlur,
  saved,
  label,
}: {
  value: string
  onChange: (v: string) => void
  onBlur: () => void
  saved: boolean
  label: string
}) {
  const t = useTokens()
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/[^0-9]/g, "").slice(0, 2))}
      onBlur={onBlur}
      keyboardType="number-pad"
      placeholder="·"
      placeholderTextColor={t.inkFaint}
      accessibilityLabel={label}
      style={{
        width: 48,
        textAlign: "center",
        fontSize: 20,
        fontWeight: "700",
        borderWidth: 1.5,
        borderColor: saved ? t.pitch : t.lineStrong,
        borderRadius: 8,
        paddingVertical: 8,
        color: saved ? t.pitch : t.ink,
        backgroundColor: saved ? t.pitchTint : t.ground,
        ...scoreDigits,
      }}
    />
  )
}
