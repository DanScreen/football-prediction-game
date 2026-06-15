import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { getActiveLeagueId } from "@/lib/activeLeague"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await getActiveLeagueId()
  if (!activeLeagueId) redirect("/leagues")

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId: activeLeagueId } },
  })
  if (membership?.role !== "COMMISSIONER") redirect("/")

  return (
    <div>
      <nav className="bg-gray-900 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center gap-6">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Admin</span>
          <Link
            href="/admin/fixtures"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Fixtures
          </Link>
          <Link
            href="/admin/results"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Results
          </Link>
          <Link
            href="/admin/import"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Import
          </Link>
          <Link
            href="/"
            className="ml-auto text-sm text-gray-500 hover:text-gray-300 transition-colors"
          >
            ← App
          </Link>
        </div>
      </nav>
      {children}
    </div>
  )
}
