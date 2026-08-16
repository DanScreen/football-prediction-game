import { useColorScheme } from "react-native"
import { darkTokens, lightTokens, type Tokens } from "@/constants/tokens"

/** Resolves Quiet Product tokens for the current OS colour scheme. */
export function useTokens(): Tokens {
  const scheme = useColorScheme()
  return scheme === "dark" ? darkTokens : lightTokens
}
