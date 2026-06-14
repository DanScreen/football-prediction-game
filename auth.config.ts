import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.isAdmin = (user as { isAdmin: boolean }).isAdmin
        token.isBot = (user as { isBot: boolean }).isBot
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.isAdmin = token.isAdmin
        session.user.isBot = token.isBot
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig
