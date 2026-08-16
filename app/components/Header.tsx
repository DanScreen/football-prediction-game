import Link from "next/link"
import { auth, signOut } from "@/auth"
import { prisma } from "@/lib/prisma"
import NavLinks from "./NavLinks"
import MobileNav from "./MobileNav"
import ThemeToggle from "./ThemeToggle"
import Logo from "./Logo"
import { getTheme } from "@/lib/theme.server"

export default async function Header() {
  const session = await auth()
  const theme = await getTheme()
  // Commissioner of *any* league, not just a selected one — the Admin link should
  // be present whenever there's something to administer.
  const isCommissioner = session?.user?.id
    ? !!(await prisma.leagueMembership.findFirst({
        where: { userId: session.user.id, role: "COMMISSIONER" },
        select: { id: true },
      }))
    : false

  return (
    <>
    <header className="bg-surface border-b border-line">
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-ink"
          >
            <Logo />
            Scorers
          </Link>
          {session && (
            <div className="flex items-center gap-2">
              <NavLinks />
              {isCommissioner && (
                <Link
                  href="/admin"
                  className="rounded-full border border-pitch/25 bg-pitch-tint px-2.5 py-0.5 text-xs font-semibold text-pitch-deep transition-colors hover:border-pitch/50"
                >
                  Admin
                </Link>
              )}
              {session.user.isSiteAdmin && (
                <Link
                  href="/host"
                  className="rounded-full border border-clock/25 bg-clock-tint px-2.5 py-0.5 text-xs font-semibold text-clock transition-colors hover:border-clock/50"
                >
                  Host
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {/* Signed in, Rules is a nav tab. Signed out there is no nav at all, so
              this is the only way in — and the rules are readable without an
              account on purpose. */}
          {!session && (
            <Link
              href="/rules"
              className="font-medium text-ink-muted transition-colors hover:text-ink"
            >
              How it works
            </Link>
          )}
          {/* Outside the session branch — the theme is a device preference and the
              auth pages need it too. */}
          <ThemeToggle theme={theme} />
          {session ? (
            <>
              {/* Stays visible on mobile — the tab bar has no Profile tab, so this
                  is the only route to it. Truncated rather than hidden. */}
              <Link
                href="/profile"
                className="max-w-24 truncate font-medium text-ink-muted transition-colors hover:text-ink sm:max-w-none"
              >
                {session.user.name ?? session.user.email}
              </Link>
              <form
                action={async () => {
                  "use server"
                  await signOut({ redirectTo: "/login" })
                }}
              >
                <button
                  type="submit"
                  className="rounded-lg border border-line-strong px-3 py-1 text-xs font-medium text-ink-mid transition-colors hover:bg-chip"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-pitch px-3 py-1.5 text-xs font-semibold text-pitch-on shadow-card transition-colors hover:bg-pitch-deep"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
    {/* Only signed-in users have anywhere to navigate to. */}
    {session && <MobileNav />}
    </>
  )
}
