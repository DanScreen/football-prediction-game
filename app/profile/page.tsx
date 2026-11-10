import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import RegenerateKeyButton from "./RegenerateKeyButton"
import DeleteAccountSection from "./DeleteAccountSection"
import AvatarForm from "./AvatarForm"
import { avatarPath } from "@/lib/avatar"

export const metadata = { title: "Profile" }

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, displayName: true, email: true, apiKey: true, isBot: true, avatarKey: true },
  })
  if (!user) redirect("/login")

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-ink">Your Profile</h1>

      <div className="bg-surface rounded-xl shadow-card border border-line divide-y divide-line-soft">
        <AvatarForm
          userId={user.id}
          displayName={user.displayName}
          avatarUrl={avatarPath(user.avatarKey)}
        />
        <Row label="Display name" value={user.displayName} />
        <Row label="Email" value={user.email} />
        {user.isBot && <Row label="Account type" value="🤖 Bot" />}
      </div>

      <div className="bg-surface rounded-xl shadow-card border border-line p-6 space-y-3">
        <h2 className="text-sm font-semibold text-ink-mid uppercase tracking-wide">API Key</h2>
        <p className="text-xs text-ink-muted">
          Use this key to submit predictions programmatically via the public API — see the{" "}
          <Link href="/api-docs" className="text-pitch font-medium hover:underline">
            API docs
          </Link>{" "}
          for endpoints and a starter bot. Keep it secret — anyone with this key can submit
          picks on your behalf.
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-md bg-chip px-3 py-2 text-sm font-mono text-ink break-all">
            {user.apiKey}
          </code>
        </div>
        <RegenerateKeyButton />
        <p className="text-xs text-ink-faint">
          Regenerating invalidates the old key immediately.
        </p>
      </div>

      <DeleteAccountSection email={user.email} />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  )
}
