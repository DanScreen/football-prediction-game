import { useState } from "react"
import { Image, Text, View } from "react-native"
import { avatarTone, initialsFor } from "@/lib/avatar"
import { API_BASE_URL } from "@/lib/config"
import { useTokens } from "@/lib/theme"
import type { Tokens } from "@/constants/tokens"

/** Initials tones, indexed by `avatarTone()` — the web maps the same indices. */
function tones(t: Tokens): { bg: string; fg: string }[] {
  return [
    { bg: t.pitchTint, fg: t.pitchDeep },
    { bg: t.clockTint, fg: t.clock },
    { bg: t.infoTint, fg: t.info },
    { bg: t.chip, fg: t.inkMid },
  ]
}

/**
 * A player's profile picture, or their initials when they haven't uploaded one
 * (or it fails to load). Hidden from VoiceOver: it always sits beside the name.
 *
 * `avatarUrl` is the site-relative path the API sends. A local file URI (a
 * just-picked photo, before the upload finishes) is used as is.
 */
export function Avatar({
  userId,
  displayName,
  avatarUrl,
  size = 28,
  ring,
}: {
  userId: string
  displayName: string
  avatarUrl: string | null | undefined
  size?: number
  /** Optional border colour, e.g. gold on the podium. */
  ring?: string
}) {
  const t = useTokens()
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const tone = tones(t)[avatarTone(userId)]
  const frame = {
    width: size,
    height: size,
    borderRadius: size / 2,
    overflow: "hidden" as const,
    ...(ring ? { borderWidth: 2, borderColor: ring } : {}),
  }

  if (avatarUrl && failedUrl !== avatarUrl) {
    const uri = avatarUrl.startsWith("/") ? `${API_BASE_URL}${avatarUrl}` : avatarUrl
    return (
      <Image
        source={{ uri }}
        onError={() => setFailedUrl(avatarUrl)}
        accessible={false}
        style={{ ...frame, backgroundColor: t.chip }}
      />
    )
  }

  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ ...frame, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}
    >
      <Text
        allowFontScaling={false}
        style={{ color: tone.fg, fontWeight: "700", fontSize: Math.round(size * 0.4) }}
      >
        {initialsFor(displayName)}
      </Text>
    </View>
  )
}
