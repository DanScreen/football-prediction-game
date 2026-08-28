import { useState, type ReactNode } from "react"
import { Pressable, Text, View } from "react-native"
import { Pill, formatPoints, scoreDigits } from "@/components/scoreboard"
import { useTokens } from "@/lib/theme"
import type { FixtureRound } from "@/lib/groupByRound"

export function RoundGroup({
  group,
  defaultOpen,
  showBankerStatus,
  children,
}: {
  group: FixtureRound
  defaultOpen: boolean
  /** For open rounds: show banker / outstanding like the web. */
  showBankerStatus?: boolean
  children: ReactNode
}) {
  const t = useTokens()
  const [open, setOpen] = useState(defaultOpen)

  const outstanding = group.fixtures.filter((f) => !f.prediction).length
  const bankerFix = group.fixtures.find((f) => f.prediction?.isBanker)

  // The web's round header carries a running subtotal. It is deliberately
  // labelled "picks" here: the streak bonus is per-league and the mobile
  // fixtures payload is league-agnostic, so folding it in would show a number
  // that matches no single leaderboard.
  const scored = sum(group.fixtures.map((f) => f.prediction?.pointsAwarded ?? null))
  const provisional = sum(group.fixtures.map((f) => f.prediction?.provisionalPoints ?? null))

  return (
    <View style={{ gap: open ? 10 : 0 }}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: t.surface,
          borderColor: t.line,
          borderWidth: 1,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
        }}
      >
        <Text style={{ color: t.inkFaint, fontSize: 12 }}>{open ? "▼" : "▶"}</Text>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: "700", color: t.ink }} numberOfLines={1}>
            {group.round}
          </Text>
          <Text style={{ color: t.inkMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
            {group.competitionName} · {group.fixtures.length} fixture
            {group.fixtures.length !== 1 ? "s" : ""} · from{" "}
            {group.kickoff.toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            {showBankerStatus ? (
              bankerFix ? (
                <Text style={{ color: t.clock, fontWeight: "600" }}>
                  {" "}
                  · ★ Banker: {bankerFix.homeTeam} v {bankerFix.awayTeam}
                </Text>
              ) : (
                <Text style={{ color: t.inkFaint }}> · no banker yet</Text>
              )
            ) : null}
          </Text>
        </View>

        {showBankerStatus ? (
          outstanding > 0 ? (
            <Pill bg={t.clockTint} border={t.clockLine} color={t.clock}>
              {outstanding} to predict
            </Pill>
          ) : (
            <Text style={{ color: t.pitch, fontSize: 11, fontWeight: "600" }}>All predicted ✓</Text>
          )
        ) : scored !== null ? (
          <Text style={{ color: t.ink, fontWeight: "700", fontSize: 13, ...scoreDigits }}>
            {formatPoints(scored)}
            <Text style={{ color: t.inkMuted, fontWeight: "400" }}> pts</Text>
          </Text>
        ) : provisional !== null ? (
          <Text style={{ color: t.clock, fontWeight: "700", fontSize: 13, ...scoreDigits }}>
            {formatPoints(provisional)} prov.
          </Text>
        ) : null}
      </Pressable>
      {open ? <View style={{ gap: 10 }}>{children}</View> : null}
    </View>
  )
}

/** `null` when nothing in the round has a figure yet — so the header stays empty. */
function sum(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null)
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0)
}
