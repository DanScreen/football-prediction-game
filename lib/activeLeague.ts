import { cookies } from "next/headers"

export const ACTIVE_LEAGUE_COOKIE = "activeLeagueId"

export async function getActiveLeagueId(): Promise<string | null> {
  const store = await cookies()
  return store.get(ACTIVE_LEAGUE_COOKIE)?.value ?? null
}
