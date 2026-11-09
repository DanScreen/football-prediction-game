import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native"
import { useTokens } from "@/lib/theme"

// Metro only bundles a static asset when it sees a literal require() call, and
// this project's TS setup has no module declaration for `*.png`, so an ESM
// import does not typecheck either. Hoisted to one place so the exception is
// stated once rather than at every use.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const markImage = require("@/assets/images/mark.png")

export function Screen({ children, style, ...rest }: ViewProps) {
  const t = useTokens()
  return (
    <View style={[{ flex: 1, backgroundColor: t.ground }, style]} {...rest}>
      {children}
    </View>
  )
}

/**
 * The scoreline mark plus the wordmark. The mark is a PNG generated from
 * `lib/mark.ts` (`npm run brand:assets`) — the app has no SVG renderer, so it
 * can't share the web component's geometry directly.
 */
export function BrandMark() {
  const t = useTokens()
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro
        // only bundles a static asset when it sees a literal require() call.
      source={markImage}
        style={{ width: 40, height: 40 }}
        accessibilityLabel="Scorers logo"
      />
      <Text style={{ fontSize: 32, fontWeight: "700", color: t.ink, letterSpacing: -0.5 }}>
        Scorers
      </Text>
    </View>
  )
}

/**
 * Just the mark, sized for a navigation bar. The web keeps the logo in the
 * header on every page; this is the tab-bar equivalent.
 */
export function HeaderMark() {
  return (
    <Image
      source={markImage}
      style={{ width: 28, height: 28, marginLeft: 16 }}
      accessibilityLabel="Scorers"
    />
  )
}

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  const t = useTokens()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: t.inkMuted }}>{label}</Text>
      <TextInput
        placeholderTextColor={t.inkFaint}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: t.lineStrong,
          backgroundColor: t.surface,
          color: t.ink,
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 16,
        }}
        {...props}
      />
    </View>
  )
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
}) {
  const t = useTokens()
  const inactive = disabled || loading
  // Disabled gets its own readable look (the old near-black-on-near-black was
  // unreadable in dark mode). Loading keeps its existing appearance.
  const off = !!disabled && !loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => ({
        backgroundColor: inactive ? t.chip : pressed ? t.pitchDeep : t.pitch,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: "center",
        opacity: loading ? 0.7 : 1,
        ...(off ? { borderWidth: 1, borderColor: t.line } : {}),
      })}
    >
      {loading ? (
        <ActivityIndicator color={t.pitchOn} />
      ) : (
        <Text
          style={{
            color: off ? t.inkMuted : t.pitchOn,
            fontSize: 16,
            fontWeight: "700",
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

export function ErrorBanner({ message }: { message: string | null }) {
  const t = useTokens()
  if (!message) return null
  return (
    <View
      style={{
        backgroundColor: t.chip,
        borderColor: t.bad,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
      }}
    >
      <Text style={{ color: t.bad, fontSize: 14 }}>{message}</Text>
    </View>
  )
}

export function PlaceholderCard({
  title,
  body,
}: {
  title: string
  body: string
}) {
  const t = useTokens()
  return (
    <View
      style={{
        backgroundColor: t.surface,
        borderColor: t.line,
        borderWidth: 1,
        borderRadius: 12,
        padding: 20,
        gap: 8,
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: "700", color: t.ink }}>{title}</Text>
      <Text style={{ fontSize: 15, lineHeight: 22, color: t.inkMuted }}>{body}</Text>
    </View>
  )
}

export const screenPadding = StyleSheet.create({
  /** Fill the screen (non-scrolling layouts). */
  pad: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 },
  /**
   * ScrollView contentContainerStyle — do NOT use flex:1 here or the list
   * cannot grow past the viewport and scrolling breaks.
   */
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 48,
    gap: 16,
    flexGrow: 1,
  },
})
