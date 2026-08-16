import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { getActiveLeagueId } from "@/lib/activeLeague"
import SettingsForm from "./SettingsForm"
import InviteCodeCard from "./InviteCodeCard"

export const metadata = { title: "League Settings" }

export default async function SettingsPage() {
  const activeLeagueId = await getActiveLeagueId()
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
