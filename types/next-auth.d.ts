import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      isBot: boolean
      isSiteAdmin: boolean
    }
  }
  interface User {
    isBot: boolean
    isSiteAdmin: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    isBot: boolean
    isSiteAdmin: boolean
  }
}
