import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native"
import { FixtureCard } from "@/components/FixtureCard"
import { PredictRow } from "@/components/PredictRow"
import { RoundGroup } from "@/components/RoundGroup"
import { scoreDigits } from "@/components/scoreboard"
import { ErrorBanner, Screen, screenPadding } from "@/components/ui"
import {
  ApiError,
  fetchFixtures,
  submitPrediction,
  type MobileFixture,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { groupByRound, takeNearestRounds, type FixtureRound } from "@/lib/groupByRound"
import { tapLight, tapSuccess } from "@/lib/haptics"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

type Draft = { home: string; away: string; isBanker: boolean }

const DEBOUNCE_MS = 450

function draftFrom(f: MobileFixture): Draft {
  return {
    home: f.prediction ? String(f.prediction.homeScore) : "",
    away: f.prediction ? String(f.prediction.awayScore) : "",
    isBanker: f.prediction?.isBanker ?? false,
  }
}

function parseScore(raw: string): number | null {
  if (raw === "") return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0) return null
  return n
}

async function fetchLiveFixtures(): Promise<MobileFixture[]> {
  const [open, locked] = await Promise.all([fetchFixtures("open"), fetchFixtures("locked")])
  return [...open, ...locked]
}

export default function PredictionsScreen() {
  const { user } = useAuth()
  const t = useTokens()
  const { data, setData, error, loading, refreshing, reload } = useAsyncData(
    fetchLiveFixtures,
    [],
  )
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({})
  const [justSavedIds, setJustSavedIds] = useState<Record<string, boolean>>({})
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savedFlashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const inFlight = useRef<Record<string, string>>({})

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

  const openRounds = useMemo(() => takeNearestRounds(groupByRound(open)), [open])
  const lockedRounds = useMemo(() => groupByRound(locked), [locked])

  useEffect(() => {
    return () => {
      for (const t of Object.values(debounceTimers.current)) clearTimeout(t)
      for (const t of Object.values(savedFlashTimers.current)) clearTimeout(t)
    }
  }, [])

  async function persist(f: MobileFixture, draft: Draft) {
    const homeScore = parseScore(draft.home)
    const awayScore = parseScore(draft.away)
    if (homeScore === null || awayScore === null) return

    const key = `${homeScore}-${awayScore}-${draft.isBanker}`
    if (
      f.prediction &&
      f.prediction.homeScore === homeScore &&
      f.prediction.awayScore === awayScore &&
      f.prediction.isBanker === draft.isBanker
    ) {
      return
    }
    if (inFlight.current[f.id] === key) return
    inFlight.current[f.id] = key

    setSavingIds((prev) => ({ ...prev, [f.id]: true }))
    setSaveErrors((prev) => {
      const next = { ...prev }
      delete next[f.id]
      return next
    })
    setJustSavedIds((prev) => {
      const next = { ...prev }
      delete next[f.id]
      return next
    })

    try {
      await submitPrediction({
        fixtureId: f.id,
        homeScore,
        awayScore,
        isBanker: draft.isBanker,
      })
      const next = await fetchLiveFixtures()
      setData(next)
      setDrafts((prev) => {
        // Steppers make it easy to tap again while this save is in flight. Only
        // drop the draft if it is still the one just saved — otherwise the row
        // would snap back to the saved score and the newer taps would be lost.
        const current = prev[f.id]
        if (
          current &&
          (current.home !== draft.home ||
            current.away !== draft.away ||
            current.isBanker !== draft.isBanker)
        ) {
          return prev
        }
        const copy = { ...prev }
        delete copy[f.id]
        return copy
      })
      setJustSavedIds((prev) => ({ ...prev, [f.id]: true }))
      if (savedFlashTimers.current[f.id]) clearTimeout(savedFlashTimers.current[f.id])
      savedFlashTimers.current[f.id] = setTimeout(() => {
        setJustSavedIds((prev) => {
          const copy = { ...prev }
          delete copy[f.id]
          return copy
        })
      }, 2500)
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [f.id]: err instanceof ApiError ? err.message : "Could not save pick.",
      }))
    } finally {
      if (inFlight.current[f.id] === key) delete inFlight.current[f.id]
      setSavingIds((prev) => {
        const copy = { ...prev }
        delete copy[f.id]
        return copy
      })
    }
  }

  function scheduleSave(f: MobileFixture, draft: Draft) {
    if (debounceTimers.current[f.id]) clearTimeout(debounceTimers.current[f.id])
    debounceTimers.current[f.id] = setTimeout(() => {
      void persist(f, draft)
    }, DEBOUNCE_MS)
  }

  function patchDraft(f: MobileFixture, patch: Partial<Draft>, autosaveScores = true) {
    setDrafts((prev) => {
      const next = { ...draftFrom(f), ...prev[f.id], ...patch }
      const updated = { ...prev, [f.id]: next }
      if (autosaveScores) {
        // Defer so the state update is visible to flush/schedule via getDraft after render;
        // schedule with the computed next draft directly.
        scheduleSave(f, next)
      }
      return updated
    })
  }

  /** One tap on +/− sets a score; an empty side starts at 0 so the pick is complete. */
  function stepScore(f: MobileFixture, side: "home" | "away", delta: 1 | -1) {
    const d = getDraft(f)
    const cur = parseScore(d[side])
    const next = cur === null ? (delta > 0 ? 1 : 0) : Math.max(0, Math.min(20, cur + delta))
    const otherValue = side === "home" ? d.away : d.home
    const filledOther = otherValue === "" ? "0" : otherValue
    const patch: Partial<Draft> =
      side === "home"
        ? { home: String(next), away: filledOther }
        : { away: String(next), home: filledOther }
    patchDraft(f, patch)
    tapLight()
  }

  async function toggleBanker(f: MobileFixture) {
    const d = getDraft(f)
    const nextBanker = !d.isBanker
    if (nextBanker) tapSuccess()
    const homeScore = parseScore(d.home)
    const awayScore = parseScore(d.away)

    // No prediction yet — keep banker in the draft until scores autosave.
    if (homeScore === null || awayScore === null) {
      patchDraft(f, { isBanker: nextBanker }, false)
      return
    }

    patchDraft(f, { isBanker: nextBanker }, false)
    if (debounceTimers.current[f.id]) {
      clearTimeout(debounceTimers.current[f.id])
      delete debounceTimers.current[f.id]
    }
    await persist(f, { ...d, isBanker: nextBanker })
  }

  function renderEditable(f: MobileFixture) {
    const d = getDraft(f)
    return (
      <PredictRow
        key={f.id}
        fixture={f}
        home={d.home}
        away={d.away}
        isBanker={d.isBanker}
        onStep={(side, delta) => stepScore(f, side, delta)}
        onToggleBanker={() => void toggleBanker(f)}
        saving={Boolean(savingIds[f.id])}
        justSaved={Boolean(justSavedIds[f.id])}
        saveError={saveErrors[f.id] ?? null}
      />
    )
  }

  function renderReadOnly(f: MobileFixture) {
    return (
      <FixtureCard
        key={f.id}
        fixture={f}
        viewerUserId={user?.id}
        hideRoundMeta
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
        {openRounds[0] ? <GameweekHeader group={openRounds[0]} /> : null}
        <ErrorBanner message={error} />

        {loading && !data ? <ActivityIndicator color={t.pitch} /> : null}

        {!loading && open.length === 0 && locked.length === 0 ? (
          <Text style={{ color: t.inkMuted, lineHeight: 22 }}>
            No fixtures to predict right now. Pull to refresh, or check the Results tab for
            settled rounds.
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

      </ScrollView>
    </Screen>
  )
}

/** Headline for the next gameweek: name, a segmented picked-progress bar, and first kick-off. */
function GameweekHeader({ group }: { group: FixtureRound }) {
  const t = useTokens()
  const total = group.fixtures.length
  const picked = group.fixtures.filter((f) => f.prediction != null).length
  const complete = picked === total
  // Predicted segments first; the stable sort keeps kick-off order within each set.
  const segments = [...group.fixtures].sort(
    (a, b) => Number(b.prediction != null) - Number(a.prediction != null),
  )

  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 12, color: t.inkMuted }}>{group.competitionName}</Text>
        <Text style={{ fontSize: 24, fontWeight: "800", color: t.ink }}>{group.round}</Text>
      </View>

      <View
        accessibilityLabel={`${picked} of ${total} fixtures predicted`}
        style={{ flexDirection: "row", gap: 4 }}
      >
        {segments.map((f) => (
          <View
            key={f.id}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: f.prediction != null ? t.pitch : t.lineStrong,
            }}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
        <Text
          style={{
            fontSize: 12,
            color: complete ? t.pitch : t.inkMid,
            fontWeight: complete ? "700" : "400",
          }}
        >
          {complete ? `All ${total} picked ✓` : `${picked} of ${total} picked`}
        </Text>
        <Text style={{ fontSize: 12, color: t.inkMid, ...scoreDigits }}>
          First kick-off{" "}
          {group.kickoff.toLocaleString("en-GB", {
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    </View>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const t = useTokens()
  return (
    <View style={{ gap: 10, marginBottom: 20 }}>
      <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  )
}
