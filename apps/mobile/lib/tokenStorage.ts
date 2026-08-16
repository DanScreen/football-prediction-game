import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

const ACCESS_KEY = "scorers.accessToken"
const REFRESH_KEY = "scorers.refreshToken"

/** SecureStore on native; localStorage fallback for Expo web. */
async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value)
    return
  }
  await SecureStore.setItemAsync(key, value)
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null
  }
  return SecureStore.getItemAsync(key)
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key)
    return
  }
  await SecureStore.deleteItemAsync(key)
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await setItem(ACCESS_KEY, accessToken)
  await setItem(REFRESH_KEY, refreshToken)
}

export async function loadTokens(): Promise<{
  accessToken: string | null
  refreshToken: string | null
}> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ])
  return { accessToken, refreshToken }
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)])
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(ACCESS_KEY)
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(REFRESH_KEY)
}
