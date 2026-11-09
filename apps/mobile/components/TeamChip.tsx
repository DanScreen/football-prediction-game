import { View } from "react-native"
import { teamColours } from "@/lib/teamColours"
import { useTokens } from "@/lib/theme"

/**
 * A small two-tone club chip. Club hexes are data, so they are the one allowed
 * exception to the tokens-only rule; an unknown team gets a neutral token chip.
 */
export function TeamChip({ team, size = 14 }: { team: string; size?: number }) {
  const t = useTokens()
  const colours = teamColours(team)

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size + 2,
        height: size + 2,
        borderRadius: (size + 2) / 2,
        borderWidth: 1,
        borderColor: t.lineStrong,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2.5,
          backgroundColor: colours ? colours.primary : t.chip,
          borderColor: colours ? colours.secondary : t.lineStrong,
        }}
      />
    </View>
  )
}
