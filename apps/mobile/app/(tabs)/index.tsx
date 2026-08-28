import { useCallback, useMemo, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native"
import { FixtureCard } from "@/components/FixtureCard"
import { RoundGroup } from "@/components/RoundGroup"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import {
  ApiError,
  fetchFixtures,
  submitPrediction,
  type MobileFixture,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { groupByRound } from "@/lib/groupByRound"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

type Draft = { home: string; away: string; isBanker: boolean }

function draftFrom(f: MobileFixture): Draft {
  return {
    home: f.prediction ? String(f.prediction.homeScore) : "",
    away: f.prediction ? String(f.prediction.awayScore) : "",
    isBanker: f.prediction?.isBanker ?? false,
  }
}

export default function PredictionsScreen() {
  const { user } = useAuth()
  const t = useTokens()
  const { data, setData, error, loading, refreshing, reload } = useAsyncData(
    () => fetchFixtures("all"),
    [],
  )
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const getDraft = useCallback(
    (f: MobileFixture): Draft => drafts[f.id] ?? draftFrom(f),
    [drafts],
  )

  const open = useMemo(
    () =>
      (data ?? []).filter(
        (f) => f.status === "SCHEDULED" && new Date(f.kickoffTime) > new Date(),
      ),
    [data],
  )
  const locked = useMemo(
    () =>
      (data ?? []).filter(
        (f) =>
          f.status === "AWAITING_RESULT" ||
          (f.status === "SCHEDULED" && new Date(f.kickoffTime) <= new Date()),
      ),
    [data],
  )
  const completed = useMemo(
    () => (data ?? []).filter((f) => f.status === "COMPLETED"),
    [data],
  )

  const openRounds = useMemo(() => groupByRound(open), [open])
  const lockedRounds = useMemo(() => groupByRound(locked), [locked])
  const completedRounds = useMemo(
    () => groupByRound(completed).slice(0, 12),
    [completed],
  )

  async function save(f: MobileFixture) {
    const d = getDraft(f)
    const homeScore = Number(d.home)
    const awayScore = Number(d.away)
    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      setSaveError("Enter whole-number scores for both teams.")
      return
    }
    setSaveError(null)
    setSavingId(f.id)
    try {
      await submitPrediction({
        fixtureId: f.id,
        homeScore,
        awayScore,
        isBanker: d.isBanker,
      })
      const next = await fetchFixtures("all")
      setData(next)
      setDrafts((prev) => {
        const copy = { ...prev }
        delete copy[f.id]
        return copy
      })
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : "Could not save pick.")
    } finally {
      setSavingId(null)
    }
  }

  function patchDraft(id: string, f: MobileFixture, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...draftFrom(f), ...prev[id], ...patch },
    }))
  }

  function renderEditable(f: MobileFixture) {
    const d = getDraft(f)
    return (
      <FixtureCard
        key={f.id}
        fixture={f}
        editable
        hideRoundMeta
        home={d.home}
        away={d.away}
        isBanker={d.isBanker}
        saving={savingId === f.id}
        onChangeHome={(home) => patchDraft(f.id, f, { home })}
        onChangeAway={(away) => patchDraft(f.id, f, { away })}
        onToggleBanker={() => patchDraft(f.id, f, { isBanker: !d.isBanker })}
        onSave={() => void save(f)}
      />
    )
  }

  function renderReadOnly(f: MobileFixture) {
    return (
      <FixtureCard
        key={f.id}
        fixture={f}
        editable={false}
        hideRoundMeta
        home=""
        away=""
        isBanker={false}
        saving={false}
        onChangeHome={() => {}}
        onChangeAway={() => {}}
        onToggleBanker={() => {}}
        onSave={() => {}}
      />
    )
  }

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={screenPadding.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void reload(true)}
            tintColor={t.pitch}
          />
        }
      >
        <Text style={{ fontSize: 15, color: t.inkMuted }}>Hi {user?.displayName}</Text>
        <ErrorBanner message={error ?? saveError} />

        {loading && !data ? <ActivityIndicator color={t.pitch} /> : null}

        {!loading && open.length === 0 && locked.length === 0 && completed.length === 0 ? (
          <Text style={{ color: t.inkMuted, lineHeight: 22 }}>
            No fixtures yet. Join a league that follows an active competition, then pull to refresh.
          </Text>
        ) : null}

        <Section title="Open">
          {openRounds.map((group, i) => (
            <RoundGroup
              key={group.key}
              group={group}
              defaultOpen={i === 0}
              showBankerStatus
            >
              {group.fixtures.map(renderEditable)}
            </RoundGroup>
          ))}
          {open.length === 0 && data ? (
            <Text style={{ color: t.inkFaint }}>Nothing open right now.</Text>
          ) : null}
        </Section>

        {lockedRounds.length > 0 ? (
          <Section title="Kicked off">
            {lockedRounds.map((group, i) => (
              <RoundGroup key={group.key} group={group} defaultOpen={i === 0}>
                {group.fixtures.map(renderReadOnly)}
              </RoundGroup>
            ))}
          </Section>
        ) : null}

        {completedRounds.length > 0 ? (
          <Section title="Results">
            {completedRounds.map((group, i) => (
              <RoundGroup key={group.key} group={group} defaultOpen={i === 0}>
                {group.fixtures.map(renderReadOnly)}
              </RoundGroup>
            ))}
          </Section>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useTokens()
  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  )
}
