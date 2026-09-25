import { prisma } from "@/lib/prisma"
import type { Prisma } from "@/app/generated/prisma/client"

export const HOST_USERS_PAGE_SIZE = 25

export type HostUserFilter = "all" | "unverified" | "verified"

export type HostUserRow = {
  id: string
  displayName: string
  email: string
  isBot: boolean
  isSiteAdmin: boolean
  createdAt: Date
  lastSeenAt: Date | null
  emailVerifiedAt: Date | null
  /** Most recent verification link, whatever address it went to. */
  lastVerificationSentAt: Date | null
  lastResetSentAt: Date | null
  leagueCount: number
}

export type HostUsersResult = {
  users: HostUserRow[]
  /** Tab counts, ignoring the search. Bots appear under "all" only. */
  counts: Record<HostUserFilter, number>
  filter: HostUserFilter
  query: string
  page: number
  totalPages: number
  /** Rows matching the current filter and search. */
  total: number
}

export function parseHostUserFilter(value: unknown): HostUserFilter {
  return value === "unverified" || value === "verified" ? value : "all"
}

function filterWhere(filter: HostUserFilter): Prisma.UserWhereInput {
  // Bots can't read email, so they have no verification state worth listing.
  if (filter === "unverified") return { isBot: false, emailVerifiedAt: null }
  if (filter === "verified") return { isBot: false, emailVerifiedAt: { not: null } }
  return {}
}

/** The `/host/users` table: every account, newest first, searchable by name or email. */
export async function listHostUsers(input: {
  filter?: HostUserFilter
  query?: string
  page?: number
}): Promise<HostUsersResult> {
  const filter = input.filter ?? "all"
  const query = input.query?.trim().slice(0, 100) ?? ""
  const where: Prisma.UserWhereInput = {
    ...filterWhere(filter),
    ...(query
      ? {
          OR: [
            { displayName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const [total, all, unverified, verified] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count(),
    prisma.user.count({ where: filterWhere("unverified") }),
    prisma.user.count({ where: filterWhere("verified") }),
  ])
  const totalPages = Math.max(1, Math.ceil(total / HOST_USERS_PAGE_SIZE))
  const page = Math.min(Math.max(1, Math.floor(input.page ?? 1) || 1), totalPages)

  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * HOST_USERS_PAGE_SIZE,
    take: HOST_USERS_PAGE_SIZE,
    select: {
      id: true,
      displayName: true,
      email: true,
      isBot: true,
      isSiteAdmin: true,
      createdAt: true,
      lastSeenAt: true,
      emailVerifiedAt: true,
      emailVerificationTokens: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      resetTokens: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      _count: { select: { memberships: true } },
    },
  })

  return {
    users: rows.map((u) => ({
      id: u.id,
      displayName: u.displayName,
      email: u.email,
      isBot: u.isBot,
      isSiteAdmin: u.isSiteAdmin,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      emailVerifiedAt: u.emailVerifiedAt,
      lastVerificationSentAt: u.emailVerificationTokens[0]?.createdAt ?? null,
      lastResetSentAt: u.resetTokens[0]?.createdAt ?? null,
      leagueCount: u._count.memberships,
    })),
    counts: { all, unverified, verified },
    filter,
    query,
    page,
    totalPages,
    total,
  }
}
