import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import RegenerateKeyButton from "./RegenerateKeyButton"

export const metadata = { title: "Profile — Footy Predictor" }

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { displayName: true, email: true, apiKey: true, isBot: true, isAdmin: true },
  })
  if (!user) redirect("/login")

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-zinc-900">Your Profile</h1>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 divide-y divide-zinc-100">
        <Row label="Display name" value={user.displayName} />
        <Row label="Email" value={user.email} />
        {user.isAdmin && <Row label="Role" value="Commissioner (Admin)" />}
        {user.isBot && <Row label="Account type" value="🤖 Bot" />}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 uppercase tracking-wide">API Key</h2>
        <p className="text-xs text-zinc-500">
          Use this key to submit predictions programmatically via the public API.
          Keep it secret — anyone with this key can submit picks on your behalf.
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-md bg-zinc-100 px-3 py-2 text-sm font-mono text-zinc-800 break-all">
            {user.apiKey}
          </code>
        </div>
        <RegenerateKeyButton />
        <p className="text-xs text-zinc-400">
          Regenerating invalidates the old key immediately.
        </p>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900">{value}</span>
    </div>
  )
}
