"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/activeLeague"
import { generateInviteCode } from "@/lib/inviteCode"

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
  const competition = String(formData.get("competition") ?? "").trim()

  if (!name) return { error: "League name is required." }
  if (name.length > 50) return { error: "League name must be 50 characters or fewer." }
  if (!competition) return { error: "Please select a competition." }

  const inviteCode = generateInviteCode()

  const league = await prisma.league.create({
    data: {
      name,
      competition,
      inviteCode,
      memberships: { create: { userId, role: "COMMISSIONER" } },
    },
  })

  await setActiveCookie(league.id)
  redirect("/admin/import")
}

export async function joinLeague(
  _prev: LeagueActionState,
  formData: FormData,
): Promise<LeagueActionState> {
  const userId = await requireUser()

  const code = String(formData.get("code") ?? "").trim().toUpperCase()
  if (!code) return { error: "Please enter an invite code." }

  const league = await prisma.league.findUnique({ where: { inviteCode: code } })
  if (!league) return { error: "No league found with that invite code." }

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

export async function selectLeague(leagueId: string): Promise<void> {
  const userId = await requireUser()

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  })
  if (!membership) return

  await setActiveCookie(leagueId)
  redirect("/")
}
