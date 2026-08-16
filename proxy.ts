import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

// `/rules` is public on purpose: someone following an invite link should be able
// to read what they're joining before creating an account. It personalises when
// there is a session, but never requires one.
const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/rules"]

export default auth((req) => {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/v1") || // authenticated per-request via Bearer API key
    pathname.startsWith("/api/mobile") || // mobile: public auth routes; others via access JWT
    pathname.startsWith("/api/cron") || // authenticated via CRON_SECRET
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
