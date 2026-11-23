import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import { recordActivity } from "@/lib/activity"

const { auth } = NextAuth(authConfig)

// `/rules` is public on purpose: someone following an invite link should be able
// to read what they're joining before creating an account. It personalises when
// there is a session, but never requires one. `/verify-email` is public because
// the link in the email is often opened on a device that isn't signed in.
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/rules",
  "/privacy",
  "/support",
  "/welcome",
]

export default auth(async (req) => {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/v1") || // authenticated per-request via Bearer API key
    pathname.startsWith("/api/mobile") || // mobile: public auth routes; others via access JWT
    pathname.startsWith("/api/cron") || // authenticated via CRON_SECRET
    pathname.startsWith("/api/avatars") || // unguessable per-picture keys; see the route
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next()
  }

  // Signed-out visitors to the root see the public homepage. The rewrite keeps
  // the browser on `/`; signed-in users fall through to the Predictions page.
  if (!req.auth && pathname === "/") {
    return NextResponse.rewrite(new URL("/welcome", req.url))
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Signed in but the email isn't verified yet: every other page funnels to the
  // "check your inbox" screen. The claim is refreshed from the DB in the jwt
  // callback, so this lifts as soon as the link is clicked.
  if (!req.auth.user?.hasVerifiedEmail) {
    return NextResponse.redirect(new URL("/verify-email", req.url))
  }

  // A signed-in page view (or client-side navigation) counts as a visit for host
  // analytics. Memoised per user per day, so this is a map lookup almost always.
  if (req.auth.user?.id) await recordActivity(req.auth.user.id, "web")

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
