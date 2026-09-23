import type { NextAuthConfig } from "next-auth"
import { isEmailVerified } from "@/lib/emailVerification"

export const authConfig = {
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.isBot = (user as { isBot: boolean }).isBot
        token.isSiteAdmin = (user as { isSiteAdmin?: boolean }).isSiteAdmin ?? false
        token.hasVerifiedEmail = (user as { hasVerifiedEmail?: boolean }).hasVerifiedEmail ?? false
      }
      // Until the claim is true, re-read it from the DB on every request. The
      // proxy re-issues the cookie with the result, so clicking the link on any
      // device lifts the gate here without signing in again — and sessions from
      // before verification existed (no claim at all) get checked too. Once
      // true it sticks, so verified users cost nothing.
      if (token.hasVerifiedEmail !== true && token.id) {
        token.hasVerifiedEmail = await isEmailVerified(token.id)
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.isBot = token.isBot
        session.user.isSiteAdmin = token.isSiteAdmin ?? false
        session.user.hasVerifiedEmail = token.hasVerifiedEmail ?? false
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
