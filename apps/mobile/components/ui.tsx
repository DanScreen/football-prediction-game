import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewProps,
} from "react-native"
import { useTokens } from "@/lib/theme"

export function Screen({ children, style, ...rest }: ViewProps) {
  const t = useTokens()
  return (
    <View style={[{ flex: 1, backgroundColor: t.ground }, style]} {...rest}>
      {children}
    </View>
  )
}

export function BrandMark() {
  const t = useTokens()
  return (
    <Text style={{ fontSize: 32, fontWeight: "700", color: t.pitch, letterSpacing: -0.5 }}>
      Scorers
    </Text>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => ({
        backgroundColor: inactive ? t.chip : pressed ? t.pitchDeep : t.pitch,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: "center",
        opacity: inactive ? 0.7 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={t.pitchOn} />
      ) : (
        <Text style={{ color: t.pitchOn, fontSize: 16, fontWeight: "700" }}>{label}</Text>
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
  pad: { flex: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 16 },
})
