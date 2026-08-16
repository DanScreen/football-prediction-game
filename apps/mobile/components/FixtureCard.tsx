import { Pressable, Text, TextInput, View } from "react-native"
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
}) {
  const t = useTokens()
  const pred = fixture.prediction
  const hasProv =
    fixture.provisionalHomeScore != null && fixture.provisionalAwayScore != null

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
        <View style={{ gap: 6 }}>
          <Text style={{ color: t.inkMid, fontVariant: ["tabular-nums"] }}>
            Your pick:{" "}
            <Text style={{ fontWeight: "700", color: t.ink }}>
              {pred ? `${pred.homeScore}–${pred.awayScore}` : "—"}
            </Text>
            {pred?.isBanker ? (
              <Text style={{ color: t.clock, fontWeight: "700" }}> ★</Text>
            ) : null}
          </Text>
          {fixture.actualHomeScore != null ? (
            <Text style={{ color: t.inkMid }}>
              Result: {fixture.actualHomeScore}–{fixture.actualAwayScore}
              {pred?.pointsAwarded != null ? (
                <Text style={{ color: t.good, fontWeight: "700" }}>
                  {" "}
                  · {pred.pointsAwarded} pts
                </Text>
              ) : null}
            </Text>
          ) : hasProv ? (
            <Text style={{ color: t.clock }}>
              Provisional: {fixture.provisionalHomeScore}–{fixture.provisionalAwayScore}
              {pred?.provisionalPoints != null ? ` · +${pred.provisionalPoints} prov.` : ""}
            </Text>
          ) : null}
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
