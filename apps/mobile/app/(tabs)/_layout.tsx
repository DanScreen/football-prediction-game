import { Pressable } from "react-native"
import { SymbolView } from "expo-symbols"
import { Tabs, router } from "expo-router"
import { HeaderMark } from "@/components/ui"
import { useTokens } from "@/lib/theme"

/**
 * Account entry point. Lives in the header rather than at the bottom of the
 * Leagues tab so it is reachable from every tab, which is where phone users
 * expect their profile to be.
 */
function AccountButton() {
  const t = useTokens()
  return (
    <Pressable
      onPress={() => router.push("/account")}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Account and sign out"
      style={({ pressed }) => ({ marginRight: 16, opacity: pressed ? 0.5 : 1 })}
    >
      <SymbolView
        name={{ ios: "person.crop.circle", android: "account_circle", web: "account_circle" }}
        tintColor={t.inkMuted}
        size={28}
      />
    </Pressable>
  )
}

export default function TabLayout() {
  const t = useTokens()

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.pitch,
        tabBarInactiveTintColor: t.inkMuted,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.line,
        },
        headerStyle: { backgroundColor: t.ground },
        headerTintColor: t.ink,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: "700" },
        headerLeft: () => <HeaderMark />,
        headerRight: () => <AccountButton />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Predictions",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "sportscourt", android: "sports_soccer", web: "sports_soccer" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: "Results",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "list.bullet.clipboard", android: "assignment", web: "assignment" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: "Leaderboard",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "list.number", android: "format_list_numbered", web: "format_list_numbered" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="leagues"
        options={{
          title: "Leagues",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "person.3", android: "groups", web: "groups" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="rules"
        options={{
          title: "Rules",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "book", android: "menu_book", web: "menu_book" }}
              tintColor={color}
              size={26}
            />
          ),
        }}
      />
    </Tabs>
  )
}
