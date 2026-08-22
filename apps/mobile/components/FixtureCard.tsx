import { Pressable, Text, TextInput, View } from "react-native"
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
  return `${pred.homeScore}–${pred.awayScore}`
}

function pointsLabel(pred: FixturePrediction, settled: boolean): string | null {
  if (settled && pred.pointsAwarded != null) return `${pred.pointsAwarded} pts`
  if (!settled && pred.provisionalPoints != null) return `+${pred.provisionalPoints} prov.`
  return null
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
  onSave,
  saving,
  editable,
}: {
  fixture: MobileFixture
  viewerUserId?: string
  home: string
  away: string
  isBanker: boolean
  onChangeHome: (v: string) => void
  onChangeAway: (v: string) => void
  onToggleBanker: () => void
  onSave: () => void
  saving: boolean
  editable: boolean
}) {
  const t = useTokens()
  const pred = fixture.prediction
  const hasProv =
    fixture.provisionalHomeScore != null && fixture.provisionalAwayScore != null
  const settled = fixture.actualHomeScore != null && fixture.actualAwayScore != null
  const showPeers = !editable && fixture.peerPredictions.length > 0

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: t.inkFaint, fontSize: 12, fontWeight: "600" }}>
          {fixture.competitionName} · {fixture.round}
        </Text>
        <Text style={{ color: t.inkFaint, fontSize: 12 }}>{formatKickoff(fixture.kickoffTime)}</Text>
      </View>

      <Text style={{ fontSize: 16, fontWeight: "700", color: t.ink }}>
        {fixture.homeTeam} vs {fixture.awayTeam}
      </Text>

      {editable ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ScoreBox value={home} onChange={onChangeHome} />
          <Text style={{ color: t.inkMuted, fontWeight: "700" }}>–</Text>
          <ScoreBox value={away} onChange={onChangeAway} />
          <Pressable
            onPress={onToggleBanker}
            style={{
              marginLeft: "auto",
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
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
              ★ Banker
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 8 }}>
          {settled ? (
            <Text style={{ color: t.inkMid }}>
              Result: {fixture.actualHomeScore}–{fixture.actualAwayScore}
            </Text>
          ) : hasProv ? (
            <Text style={{ color: t.clock }}>
              Provisional: {fixture.provisionalHomeScore}–{fixture.provisionalAwayScore}
            </Text>
          ) : null}

          {showPeers ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: t.lineSoft,
                paddingTop: 8,
                gap: 6,
              }}
            >
              {fixture.peerPredictions.map((p) => {
                const isYou = viewerUserId != null && p.userId === viewerUserId
                const pts = pointsLabel(p, settled)
                return (
                  <View
                    key={p.userId}
                    style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}
                  >
                    <Text
                      style={{
                        width: 96,
                        color: isYou ? t.pitch : t.inkMuted,
                        fontWeight: isYou ? "700" : "500",
                        fontSize: 14,
                      }}
                      numberOfLines={1}
                    >
                      {isYou ? "You" : `${p.isBot ? "🤖 " : ""}${p.displayName}`}
                    </Text>
                    <Text
                      style={{
                        fontWeight: "700",
                        color: isYou ? t.ink : t.inkMid,
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatPick(p)}
                    </Text>
                    {p.isBanker ? (
                      <Text style={{ color: t.clock, fontWeight: "700", fontSize: 13 }}>★</Text>
                    ) : null}
                    {pts ? (
                      <Text
                        style={{
                          color: settled ? t.good : t.clock,
                          fontWeight: "700",
                          fontSize: 13,
                        }}
                      >
                        {pts}
                      </Text>
                    ) : null}
                  </View>
                )
              })}
            </View>
          ) : (
            <Text style={{ color: t.inkMid, fontVariant: ["tabular-nums"] }}>
              Your pick:{" "}
              <Text style={{ fontWeight: "700", color: t.ink }}>
                {pred ? formatPick(pred) : "—"}
              </Text>
              {pred?.isBanker ? (
                <Text style={{ color: t.clock, fontWeight: "700" }}> ★</Text>
              ) : null}
              {pred && settled && pred.pointsAwarded != null ? (
                <Text style={{ color: t.good, fontWeight: "700" }}> · {pred.pointsAwarded} pts</Text>
              ) : null}
              {pred && !settled && pred.provisionalPoints != null ? (
                <Text style={{ color: t.clock, fontWeight: "700" }}>
                  {" "}
                  · +{pred.provisionalPoints} prov.
                </Text>
              ) : null}
            </Text>
          )}
        </View>
      )}

      {editable ? (
        <Pressable
          onPress={onSave}
          disabled={saving}
          style={{
            backgroundColor: t.pitch,
            borderRadius: 8,
            paddingVertical: 10,
            alignItems: "center",
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: t.pitchOn, fontWeight: "700" }}>
            {saving ? "Saving…" : pred ? "Update pick" : "Save pick"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

function ScoreBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTokens()
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/[^0-9]/g, "").slice(0, 2))}
      keyboardType="number-pad"
      style={{
        width: 48,
        textAlign: "center",
        fontSize: 20,
        fontWeight: "700",
        fontVariant: ["tabular-nums"],
        borderWidth: 1,
        borderColor: t.lineStrong,
        borderRadius: 8,
        paddingVertical: 8,
        color: t.ink,
        backgroundColor: t.ground,
      }}
    />
  )
}
