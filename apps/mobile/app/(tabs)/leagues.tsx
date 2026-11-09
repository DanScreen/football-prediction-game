import { useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  View,
} from "react-native"
import { router } from "expo-router"
import {
  ErrorBanner,
  Field,
  PrimaryButton,
  Screen,
  screenPadding,
} from "@/components/ui"
import {
  ApiError,
  createLeague,
  fetchCompetitions,
  fetchLeaderboards,
  fetchLeagues,
  joinLeague,
  type CompetitionOption,
  type LeaderboardBlock,
  type LeaderboardEntry,
  type LeagueSummary,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/config"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

export default function LeaguesScreen() {
  const { refreshProfile, user } = useAuth()
  const t = useTokens()
  const leagues = useAsyncData(() => fetchLeagues(), [])
  // Leaderboards only add positions to the cards. If they fail to load the
  // cards still render, just without a position.
  const boards = useAsyncData(
    (): Promise<LeaderboardBlock[]> => fetchLeaderboards().catch((): LeaderboardBlock[] => []),
    [],
  )
  const comps = useAsyncData(() => fetchCompetitions(), [])
  const [joinCode, setJoinCode] = useState("")
  const [createName, setCreateName] = useState("")
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showForms, setShowForms] = useState(false)

  // Leagues on a competition a host has declared finished stay reachable, but
  // sit under their own heading so they stop crowding the live ones.
  const { live, finished } = useMemo(() => {
    const all = leagues.data ?? []
    return {
      live: all.filter((l) => !l.competitionArchived),
      finished: all.filter((l) => l.competitionArchived),
    }
  }, [leagues.data])

  const boardByLeague = useMemo(() => {
    const map = new Map<string, LeaderboardBlock>()
    for (const block of boards.data ?? []) map.set(block.leagueId, block)
    return map
  }, [boards.data])

  const hasLeagues = (leagues.data?.length ?? 0) > 0
  // With no leagues the forms are the whole point of the screen, so they show
  // straight away. Otherwise they sit behind a button.
  const formsVisible = showForms || (!hasLeagues && !leagues.loading)
  const showJoinButton = hasLeagues && !showForms

  function reloadAll() {
    return Promise.all([leagues.reload(true), boards.reload(true)])
  }

  async function onJoin() {
    setFormError(null)
    setBusy(true)
    try {
      await joinLeague(joinCode)
      setJoinCode("")
      setShowForms(false)
      await reloadAll()
      await refreshProfile()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not join league.")
    } finally {
      setBusy(false)
    }
  }

  async function onCreate() {
    setFormError(null)
    if (!competitionId) {
      setFormError("Pick a competition.")
      return
    }
    setBusy(true)
    try {
      await createLeague(createName, competitionId)
      setCreateName("")
      setShowForms(false)
      await reloadAll()
      await refreshProfile()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not create league.")
    } finally {
      setBusy(false)
    }
  }

  async function shareInvite(league: LeagueSummary) {
    if (!league.inviteCode) return
    const web = `${API_BASE_URL}/register?invite=${league.inviteCode}`
    const app = `scorers://join?code=${league.inviteCode}`
    await Share.share({
      message: `Join my Scorers league "${league.name}"!\nCode: ${league.inviteCode}\n${web}\nOr open in the app: ${app}`,
    })
  }

  const viewerId = user?.id

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={screenPadding.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={leagues.refreshing || boards.refreshing}
            onRefresh={() => void reloadAll()}
            tintColor={t.pitch}
          />
        }
      >
        <ErrorBanner message={leagues.error ?? formError} />
        {leagues.loading && !leagues.data ? <ActivityIndicator color={t.pitch} /> : null}

        <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
          YOUR LEAGUES
        </Text>
        {leagues.data?.length === 0 ? (
          <Text style={{ color: t.inkMuted }}>You are not in a league yet — create or join one below.</Text>
        ) : null}
        {live.length === 0 && finished.length > 0 ? (
          <Text style={{ color: t.inkMuted }}>
            Every league you are in is on a competition that has finished.
          </Text>
        ) : null}
        {live.map((l) => (
          <LeagueCard
            key={l.id}
            league={l}
            board={boardByLeague.get(l.id)}
            viewerId={viewerId}
            onShare={() => void shareInvite(l)}
          />
        ))}

        {finished.length > 0 ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
              FINISHED ({finished.length})
            </Text>
            {finished.map((l) => (
              <LeagueCard
                key={l.id}
                league={l}
                board={boardByLeague.get(l.id)}
                viewerId={viewerId}
                onShare={() => void shareInvite(l)}
              />
            ))}
          </>
        ) : null}

        {showJoinButton ? (
          <PrimaryButton label="Join or create a league" onPress={() => setShowForms(true)} />
        ) : null}

        {formsVisible && hasLeagues ? (
          <Pressable
            onPress={() => setShowForms(false)}
            accessibilityRole="button"
            style={{ alignItems: "center", paddingVertical: 4 }}
          >
            <Text style={{ color: t.inkMuted, fontWeight: "600" }}>Close</Text>
          </Pressable>
        ) : null}

        {formsVisible ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
              JOIN WITH CODE
            </Text>
            <Field label="Invite code" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
            <PrimaryButton label="Join league" onPress={() => void onJoin()} loading={busy} disabled={!joinCode} />

            <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
              CREATE A LEAGUE
            </Text>
            <Field label="League name" value={createName} onChangeText={setCreateName} autoCapitalize="words" />
            <CompetitionPicker
              competitions={comps.data ?? []}
              selectedId={competitionId}
              onSelect={setCompetitionId}
            />
            <PrimaryButton
              label="Create league"
              onPress={() => void onCreate()}
              loading={busy}
              disabled={!createName || !competitionId}
            />
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

function CompetitionPicker({
  competitions,
  selectedId,
  onSelect,
}: {
  competitions: CompetitionOption[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const t = useTokens()
  if (competitions.length === 0) {
    return <Text style={{ color: t.inkFaint }}>No active competitions available.</Text>
  }
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: t.inkMuted }}>Competition</Text>
      {competitions.map((c) => {
        const selected = c.id === selectedId
        return (
          <Pressable
            key={c.id}
            onPress={() => onSelect(c.id)}
            style={{
              borderWidth: 1,
              borderColor: selected ? t.pitch : t.lineStrong,
              backgroundColor: selected ? t.pitchTint : t.surface,
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Text style={{ color: t.ink, fontWeight: selected ? "700" : "500" }}>{c.name}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/** 1 → "1st", 2 → "2nd", 3 → "3rd", 11–13 → "11th"/"12th"/"13th". */
function ordinal(n: number): string {
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

/** Points are whole numbers except for the odd half, so one decimal place is enough. */
function roundPoints(n: number): number {
  return Math.round(n * 10) / 10
}

function formatPoints(n: number): string {
  return String(roundPoints(n))
}

/**
 * The line under the position. `above` is the player immediately ahead of the
 * viewer in the (already sorted) standings, if there is one.
 */
function standingLine(me: LeaderboardEntry, above: LeaderboardEntry | undefined): string | null {
  if (me.rank === 1) return "Top of the league"
  if (!above) return null
  const gap = roundPoints(above.totalPoints - me.totalPoints)
  if (gap === 0) return `Level with ${above.displayName}`
  return `${formatPoints(gap)} behind ${above.displayName}`
}

function LeagueCard({
  league,
  board,
  viewerId,
  onShare,
}: {
  league: LeagueSummary
  board: LeaderboardBlock | undefined
  viewerId: string | undefined
  onShare: () => void
}) {
  const t = useTokens()
  const archived = league.competitionArchived === true
  const standings = board?.standings ?? []
  const index = viewerId ? standings.findIndex((r) => r.id === viewerId) : -1
  const me = index >= 0 ? standings[index] : undefined
  const above = index > 0 ? standings[index - 1] : undefined
  const line = me && standings.length >= 2 ? standingLine(me, above) : null
  // A finished league is closed to new members, so the invite code is no use.
  const canInvite = !!league.inviteCode && !archived

  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        gap: 6,
        opacity: archived ? 0.75 : 1,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={{ fontWeight: "700", fontSize: 16, color: t.ink, flexShrink: 1 }}>
            {league.name}
          </Text>
          {archived ? (
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: t.inkMuted,
                backgroundColor: t.chip,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              Finished
            </Text>
          ) : null}
        </View>
        {me ? (
          <Text style={{ fontSize: 22, fontWeight: "800", color: t.ink }}>{ordinal(me.rank)}</Text>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <Text style={{ color: t.inkMuted, flexShrink: 1 }}>
          {league.competitionName}
          {league.role === "COMMISSIONER" ? " · You run this league" : ""}
        </Text>
        {me ? (
          <Text style={{ fontSize: 12, color: t.inkMuted }}>
            {`of ${standings.length} · ${formatPoints(me.totalPoints)} pts`}
          </Text>
        ) : null}
      </View>

      {line ? <Text style={{ fontSize: 13, color: t.inkMid }}>{line}</Text> : null}

      <View style={{ flexDirection: "row", alignItems: "center", gap: 18, marginTop: 6 }}>
        <Pressable
          onPress={() => router.navigate("/(tabs)/leaderboard")}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={{ color: t.pitch, fontWeight: "700" }}>Open table</Text>
        </Pressable>
        {canInvite ? (
          <>
            <Pressable onPress={onShare} hitSlop={8} accessibilityRole="button">
              <Text style={{ color: t.pitch, fontWeight: "700" }}>Invite</Text>
            </Pressable>
            <Text style={{ marginLeft: "auto", fontSize: 12, color: t.inkFaint }}>
              {`Code ${league.inviteCode}`}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  )
}
