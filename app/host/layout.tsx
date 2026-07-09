import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function HostLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isSiteAdmin: true },
  })
  if (!user?.isSiteAdmin) redirect("/")

  return (
    <div>
      <nav className="bg-board text-board-fore px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center gap-6">
          <span className="text-xs font-bold text-board-gold uppercase tracking-widest">Host</span>
          <Link
            href="/host/competitions"
            className="text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            Competitions
          </Link>
          <Link
            href="/host/fixtures"
            className="text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            Fixtures
          </Link>
          <Link
            href="/host/import"
            className="text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            Import
          </Link>
          <Link
            href="/host/results"
            className="text-sm text-board-muted hover:text-board-fore transition-colors"
          >
            Results
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
