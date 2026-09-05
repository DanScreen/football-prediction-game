"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/activeLeague"
import { generateInviteCode, normaliseInviteCode } from "@/lib/inviteCode"

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

async function setActiveCookie(leagueId: string) {
  const store = await cookies()
  store.set(ACTIVE_LEAGUE_COOKIE, leagueId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  })
}

export type LeagueActionState = {
  error?: string
}

export async function createLeague(
  _prev: LeagueActionState,
  formData: FormData,
): Promise<LeagueActionState> {
  const userId = await requireUser()

  const name = String(formData.get("name") ?? "").trim()
  const competitionId = String(formData.get("competitionId") ?? "").trim()

  if (!name) return { error: "League name is required." }
  if (name.length > 50) return { error: "League name must be 50 characters or fewer." }
  if (!competitionId) return { error: "Please select a competition." }

  const competition = await prisma.competition.findUnique({ where: { id: competitionId } })
  if (!competition || !competition.isActive || competition.archivedAt) {
    return { error: "That competition isn't available." }
  }

  const inviteCode = generateInviteCode()

  const league = await prisma.league.create({
    data: {
      name,
      competitionId,
      inviteCode,
      memberships: { create: { userId, role: "COMMISSIONER" } },
    },
  })

  await setActiveCookie(league.id)
  redirect("/")
}

export async function joinLeague(
  _prev: LeagueActionState,
  formData: FormData,
): Promise<LeagueActionState> {
  const userId = await requireUser()

  const code = normaliseInviteCode(formData.get("code") as string | null)
  if (!code) return { error: "Please enter an invite code." }

  const league = await prisma.league.findUnique({
    where: { inviteCode: code },
    include: { competition: { select: { name: true, archivedAt: true } } },
  })
  if (!league) return { error: "No league found with that invite code." }
  if (league.competition.archivedAt) {
    return { error: `${league.competition.name} has finished — that league is closed to new members.` }
  }

  const existing = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId: league.id } },
  })
  if (existing) return { error: "You're already a member of that league." }

  await prisma.leagueMembership.create({
    data: { userId, leagueId: league.id, role: "MEMBER" },
  })

  await setActiveCookie(league.id)
  redirect("/")
}

/**
 * Choose which league the commissioner area manages. Predictions and leaderboards
 * span every league, so this no longer changes what a player sees — hence the
 * redirect into /admin rather than back to the predictions page.
 */
export async function selectLeague(leagueId: string): Promise<void> {
  const userId = await requireUser()

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  })
  if (!membership) return

  await setActiveCookie(leagueId)
  redirect(membership.role === "COMMISSIONER" ? "/admin/settings" : "/")
}
