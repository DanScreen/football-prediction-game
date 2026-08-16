import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { resolveCommissionerLeagueId } from "@/lib/activeLeague"
import SettingsForm from "./SettingsForm"
import InviteCodeCard from "./InviteCodeCard"

export const metadata = { title: "League Settings" }

export default async function SettingsPage() {
  // AdminLayout already gates on commissioner; this resolves the same league again
  // so the page never renders against a different one than the layout authorised.
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const activeLeagueId = await resolveCommissionerLeagueId(session.user.id)
  if (!activeLeagueId) redirect("/leagues")

  const league = await prisma.league.findUnique({ where: { id: activeLeagueId } })
  if (!league) redirect("/leagues")

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-ink mb-1">League Settings</h1>
      <p className="text-ink-muted text-sm mb-6">{league.name}</p>

      <div className="space-y-6">
        <SettingsForm
          defaultValues={{
            name: league.name,
            grandSlamEnabled: league.grandSlamEnabled,
            grandSlamPoints: league.grandSlamPoints,
          }}
        />
        <InviteCodeCard inviteCode={league.inviteCode} />
      </div>
    </div>
  )
}
