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
  fetchLeagues,
  joinLeague,
  type CompetitionOption,
  type LeagueSummary,
} from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/config"
import { useTokens } from "@/lib/theme"
import { useAsyncData } from "@/lib/useAsyncData"

export default function LeaguesScreen() {
  const { refreshProfile } = useAuth()
  const t = useTokens()
  const leagues = useAsyncData(() => fetchLeagues(), [])
  const comps = useAsyncData(() => fetchCompetitions(), [])
  const [joinCode, setJoinCode] = useState("")
  const [createName, setCreateName] = useState("")
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Leagues on a competition a host has declared finished stay reachable, but
  // sit under their own heading so they stop crowding the live ones.
  const { live, finished } = useMemo(() => {
    const all = leagues.data ?? []
    return {
      live: all.filter((l) => !l.competitionArchived),
      finished: all.filter((l) => l.competitionArchived),
    }
  }, [leagues.data])

  async function onJoin() {
    setFormError(null)
    setBusy(true)
    try {
      await joinLeague(joinCode)
      setJoinCode("")
      await leagues.reload(true)
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
      await leagues.reload(true)
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

  return (
    <Screen>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={screenPadding.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={leagues.refreshing}
            onRefresh={() => void leagues.reload(true)}
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
          <LeagueCard key={l.id} league={l} onShare={() => void shareInvite(l)} />
        ))}

        {finished.length > 0 ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: "700", color: t.inkMuted, letterSpacing: 0.6 }}>
              FINISHED ({finished.length})
            </Text>
            {finished.map((l) => (
              <LeagueCard key={l.id} league={l} onShare={() => void shareInvite(l)} />
            ))}
          </>
        ) : null}

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

function LeagueCard({ league, onShare }: { league: LeagueSummary; onShare: () => void }) {
  const t = useTokens()
  const archived = league.competitionArchived === true
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
      <Text style={{ color: t.inkMuted }}>
        {league.competitionName} · {league.role}
      </Text>
      {/* A finished league is closed to new members, so the invite code is no use. */}
      {league.inviteCode && !archived ? (
        <>
          <Text style={{ color: t.inkFaint, fontSize: 13 }}>Code: {league.inviteCode}</Text>
          <Pressable onPress={onShare} style={{ marginTop: 4 }}>
            <Text style={{ color: t.pitch, fontWeight: "700" }}>Share invite</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  )
}
