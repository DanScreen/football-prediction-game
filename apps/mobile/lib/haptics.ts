import * as Haptics from "expo-haptics"
import { Platform } from "react-native"

/** A light tick for each score step. No-op on web; never throws. */
export function tapLight(): void {
  if (Platform.OS === "web") return
  Haptics.selectionAsync().catch(() => {})
}

/** A success buzz when a banker is set. No-op on web; never throws. */
export function tapSuccess(): void {
  if (Platform.OS === "web") return
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}
