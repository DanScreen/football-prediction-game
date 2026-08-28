import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { resolveCommissionerLeagueId } from "@/lib/activeLeague"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await resolveCommissionerLeagueId(session.user.id)
  if (!activeLeagueId) redirect("/leagues")

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId: activeLeagueId } },
  })
  if (membership?.role !== "COMMISSIONER") redirect("/")

  return (
    <div>
      <nav className="bg-board text-board-fore px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center gap-6">
          <span className="text-xs font-bold text-board-gold uppercase tracking-widest">
            League Admin
          </span>
          <Link
            href="/admin/picks"
            className="text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            Pick status
          </Link>
          <Link
            href="/admin/settings"
            className="text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            Settings
          </Link>
          <Link
            href="/"
            className="ml-auto text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            ← App
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
