import { Text, View } from "react-native"
import { useAuth } from "@/lib/auth"
import { useTokens } from "@/lib/theme"
import { PlaceholderCard, PrimaryButton, Screen, screenPadding } from "@/components/ui"

export default function LeaguesScreen() {
  const { me, logout } = useAuth()
  const t = useTokens()

  return (
    <Screen>
      <View style={screenPadding.pad}>
        <PlaceholderCard
          title="Leagues"
          body="Create and join flows land in Phase 3. Your current memberships from /me:"
        />
        {me?.leagues?.length ? (
          <View style={{ gap: 8 }}>
            {me.leagues.map((l) => (
              <View
                key={l.id}
                style={{
                  backgroundColor: t.surface,
                  borderColor: t.line,
                  borderWidth: 1,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <Text style={{ fontWeight: "700", color: t.ink }}>{l.name}</Text>
                <Text style={{ color: t.inkMuted, marginTop: 4 }}>
                  {l.competitionName} · {l.role}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: t.inkMuted }}>No leagues yet — join one from the website or wait for Phase 3.</Text>
        )}
        <PrimaryButton label="Sign out" onPress={() => void logout()} />
      </View>
    </Screen>
  )
}
