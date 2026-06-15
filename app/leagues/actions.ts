"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { lookupUpcomingFixtures, type ProposedFixture } from "@/lib/ai"
import { ACTIVE_LEAGUE_COOKIE } from "@/lib/activeLeague"

async function requireUser() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session.user.id
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
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
  // Set after league is created — triggers fixture confirmation step
  pendingLeague?: {
    id: string
    name: string
    competition: string
    inviteCode: string
    proposed: ProposedFixture[]
    aiError?: string
  }
}

export const COMPETITIONS = [
  { value: "Premier League", label: "Premier League", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { value: "FIFA World Cup 2026", label: "World Cup 2026", flag: "🌍" },
] as const

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

  // Attempt AI fixture lookup
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      pendingLeague: {
        id: league.id,
        name: league.name,
        competition: league.competition,
        inviteCode: league.inviteCode,
        proposed: [],
        aiError: "ANTHROPIC_API_KEY is not configured — add fixtures manually via Admin.",
      },
    }
  }

  try {
    const proposed = await lookupUpcomingFixtures(competition)
    return {
      pendingLeague: {
        id: league.id,
        name: league.name,
        competition: league.competition,
        inviteCode: league.inviteCode,
        proposed,
      },
    }
  } catch (err) {
    return {
      pendingLeague: {
        id: league.id,
        name: league.name,
        competition: league.competition,
        inviteCode: league.inviteCode,
        proposed: [],
        aiError: err instanceof Error ? err.message : "AI lookup failed — add fixtures manually.",
      },
    }
  }
}

export type ConfirmFixturesState = { error?: string }

export async function confirmLeagueFixtures(
  _prev: ConfirmFixturesState,
  formData: FormData,
): Promise<ConfirmFixturesState> {
  const userId = await requireUser()

  const leagueId = String(formData.get("leagueId") ?? "")
  const raw = String(formData.get("fixtures") ?? "")

  if (!leagueId) return { error: "Missing league ID." }

  // Verify user is commissioner of this league
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  })
  if (membership?.role !== "COMMISSIONER") return { error: "Unauthorised." }

  let fixtures: ProposedFixture[] = []
  if (raw) {
    try {
      fixtures = JSON.parse(raw) as ProposedFixture[]
    } catch {
      return { error: "Invalid fixture data." }
    }
  }

  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return { error: "League not found." }

  for (const f of fixtures) {
    const kickoffTime = new Date(f.kickoffTime)
    if (isNaN(kickoffTime.getTime())) continue
    await prisma.fixture.create({
      data: {
        leagueId,
        competition: league.competition,
        round: f.round ?? "Round 1",
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        kickoffTime,
      },
    })
  }

  redirect("/")
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
