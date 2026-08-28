import { SymbolView } from "expo-symbols"
import { Tabs } from "expo-router"
import { HeaderMark } from "@/components/ui"
import { useTokens } from "@/lib/theme"

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
