import Link from "next/link"
import { auth } from "@/auth"
import { signOut } from "@/auth"

export default async function Header() {
  const session = await auth()

  return (
    <header className="bg-[#1a7a3c] text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight hover:text-green-200 transition-colors"
          >
            ⚽ Footy Predictor
          </Link>
          {session && (
            <nav className="hidden sm:flex items-center gap-4 text-sm font-medium">
              <Link href="/" className="hover:text-green-200 transition-colors">
                Dashboard
              </Link>
              <Link href="/predictions" className="hover:text-green-200 transition-colors">
                My Predictions
              </Link>
              <Link href="/leaderboard" className="hover:text-green-200 transition-colors">
                Leaderboard
              </Link>
              {session.user.isAdmin && (
                <Link
                  href="/admin"
                  className="bg-yellow-400 text-green-900 px-3 py-1 rounded-full text-xs font-bold hover:bg-yellow-300 transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <Link href="/profile" className="hover:text-green-200 transition-colors">
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
                  className="bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-full text-xs font-medium"
                >
                  Logout
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-green-200 transition-colors">
                Login
              </Link>
              <Link
                href="/register"
                className="bg-white/20 hover:bg-white/30 transition-colors px-3 py-1 rounded-full text-xs font-medium"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
