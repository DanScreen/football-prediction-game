/**
 * Sends Expo push notifications. Uses the public Expo push API — no server
 * secret required for basic delivery. Invalid tokens are ignored.
 */
export async function sendExpoPush(
  messages: Array<{ to: string; title: string; body: string; data?: Record<string, string> }>,
): Promise<{ sent: number }> {
  if (messages.length === 0) return { sent: 0 }

  // Expo accepts batches of up to 100
  let sent = 0
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      })
      if (res.ok) sent += chunk.length
    } catch {
      // Cron should not fail hard on push outages
    }
  }
  return { sent }
}
