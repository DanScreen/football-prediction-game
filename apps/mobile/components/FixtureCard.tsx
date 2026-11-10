import { Text, View } from "react-native"
import {
  BankerTag,
  NailedIt,
  PointsBadge,
  formatPoints,
  scoreDigits,
} from "@/components/scoreboard"
import { TeamChip } from "@/components/TeamChip"
import { useTokens } from "@/lib/theme"
import { groupPicksByScore } from "@/lib/groupPicks"
import type { FixturePrediction, MobileFixture } from "@/lib/api"
import { Avatar } from "@/components/Avatar"

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

/**
 * A kicked-off or settled fixture: the scoreline as the headline, your pick and
 * why it scored what it did, then everyone else's picks grouped by scoreline.
 * Open fixtures are edited in `PredictRow`, not here.
 */
export function FixtureCard({
  fixture,
  viewerUserId,
  /** When true, hide competition/round (shown on the round header instead). */
  hideRoundMeta = false,
}: {
  fixture: MobileFixture
  viewerUserId?: string
  hideRoundMeta?: boolean
}) {
  const t = useTokens()
  const pred = fixture.prediction
  const settled = fixture.actualHomeScore != null && fixture.actualAwayScore != null
  const hasProv = fixture.provisionalHomeScore != null && fixture.provisionalAwayScore != null
  const tone = pred?.pointsAwarded != null ? baseTone(pred.pointsAwarded, pred.isBanker) : null

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

  // Read-only: the headline score. Settled → final, provisional → live, else a dot.
  const headline = settled
    ? { text: `${fixture.actualHomeScore} – ${fixture.actualAwayScore}`, color: t.ink }
    : hasProv
      ? { text: `${fixture.provisionalHomeScore} – ${fixture.provisionalAwayScore}`, color: t.clock }
      : { text: "· – ·", color: t.inkFaint }

  // Everyone else's picks, collapsed to one row per scoreline.
  const others = fixture.peerPredictions.filter((p) => p.userId !== viewerUserId)
  const groups = groupPicksByScore(others)

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
      <Text style={{ color: t.inkFaint, fontSize: 12 }} numberOfLines={1}>
        {hideRoundMeta
          ? formatKickoff(fixture.kickoffTime)
          : `${fixture.competitionName} · ${fixture.round} · ${formatKickoff(fixture.kickoffTime)}`}
      </Text>

      {/* Score line: the final score is the headline, teams either side. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text
          style={{ flex: 1, textAlign: "right", fontSize: 15, fontWeight: "700", color: t.ink }}
          numberOfLines={1}
        >
          {fixture.homeTeam}
        </Text>
        <TeamChip team={fixture.homeTeam} />
        <View
          style={{
            backgroundColor: t.ground,
            borderRadius: 8,
            paddingHorizontal: 10,
            paddingVertical: 4,
            alignItems: "center",
          }}
        >
          <Text
            style={{ fontSize: 22, fontWeight: "700", color: headline.color, ...scoreDigits }}
          >
            {headline.text}
          </Text>
        </View>
        <TeamChip team={fixture.awayTeam} />
        <Text
          style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: "700", color: t.ink }}
          numberOfLines={1}
        >
          {fixture.awayTeam}
        </Text>
      </View>
      {settled ? null : hasProv ? (
        <Text
          style={{
            color: t.clock,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            textAlign: "center",
          }}
        >
          PROVISIONAL
        </Text>
      ) : (
        <Text
          style={{
            color: t.inkFaint,
            fontSize: 10,
            fontWeight: "700",
            letterSpacing: 0.6,
            textAlign: "center",
          }}
        >
          AWAITING RESULT
        </Text>
      )}

      {/* Your line: your pick, and why it scored what it did. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {pred ? (
          <>
            <Text style={{ color: t.pitch, fontWeight: "700" }}>You</Text>
            <Text style={{ fontWeight: "700", color: t.ink, ...scoreDigits }}>
              {formatPick(pred)}
            </Text>
            {pred.isBanker ? <BankerTag /> : null}
            {tone !== null && pred.pointsAwarded != null ? (
              <>
                <PointsBadge points={pred.pointsAwarded} tone={tone} />
                {tone === 3 ? <NailedIt /> : null}
                {tone === 1.5 ? (
                  <Text style={{ color: t.info, fontSize: 12, fontWeight: "600" }}>
                    One goal out
                  </Text>
                ) : null}
                {tone === 1 ? (
                  <Text style={{ color: t.inkMuted, fontSize: 12, fontWeight: "600" }}>
                    Right result
                  </Text>
                ) : null}
                {tone === 0 ? (
                  <Text style={{ color: t.inkMuted, fontSize: 12, fontWeight: "600" }}>
                    Wrong result
                  </Text>
                ) : null}
              </>
            ) : pred.provisionalPoints != null ? (
              <Text style={{ color: t.clock, fontWeight: "700", ...scoreDigits }}>
                {formatPoints(pred.provisionalPoints)} prov.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={{ fontStyle: "italic", color: t.inkFaint, fontSize: 13 }}>
            You didn&apos;t predict this one.
          </Text>
        )}
      </View>

      {/* Everyone else, grouped by scoreline. */}
      {groups.length > 0 ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.lineSoft, paddingTop: 8, gap: 6 }}>
          {groups.map((g) => {
            const plainNames = g.picks.map((p) => p.displayName).join(", ")
            return (
              <View
                key={`${g.homeScore}-${g.awayScore}`}
                accessibilityLabel={`${g.homeScore}–${g.awayScore}: ${plainNames}`}
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}
              >
                <Text style={{ width: 46, fontWeight: "700", color: t.inkMid, ...scoreDigits }}>
                  {g.homeScore} – {g.awayScore}
                </Text>
                <View
                  style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 4 }}
                >
                  {g.picks.map((p) => (
                    <View
                      key={p.userId}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      <Avatar
                        userId={p.userId}
                        displayName={p.displayName}
                        avatarUrl={p.avatarUrl}
                        size={18}
                      />
                      <Text style={{ fontSize: 13, color: t.inkMuted, lineHeight: 18 }}>
                        {`${p.isBot ? "🤖 " : ""}${p.displayName}${p.isBanker ? " ★" : ""}`}
                      </Text>
                    </View>
                  ))}
                </View>
                {g.basePoints !== null ? (
                  settled ? (
                    <PointsBadge points={g.basePoints} tone={g.basePoints} />
                  ) : (
                    <Text
                      style={{ color: t.clock, fontSize: 12, fontWeight: "700", ...scoreDigits }}
                    >
                      {formatPoints(g.basePoints)} prov.
                    </Text>
                  )
                ) : null}
              </View>
            )
          })}
        </View>
      ) : pred ? (
        <View style={{ borderTopWidth: 1, borderTopColor: t.lineSoft, paddingTop: 8 }}>
          <Text style={{ color: t.inkFaint, fontSize: 13, fontStyle: "italic" }}>
            No one else in your leagues predicted this one.
          </Text>
        </View>
      ) : null}
    </View>
  )
}
