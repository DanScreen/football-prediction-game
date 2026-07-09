import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.isBot = (user as { isBot: boolean }).isBot
        token.isSiteAdmin = (user as { isSiteAdmin?: boolean }).isSiteAdmin ?? false
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.isBot = token.isBot
        session.user.isSiteAdmin = token.isSiteAdmin ?? false
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
