import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      isBot: boolean
    }
  }
  interface User {
    isBot: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    isBot: boolean
  }
}
