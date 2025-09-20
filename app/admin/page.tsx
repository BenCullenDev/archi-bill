import { inArray, desc, eq, sql } from 'drizzle-orm'
import { AdminDashboard } from '@/components/admin/admin-dashboard'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { db, schema } from '@/db'

type AdminUser = {
  id: string
  email: string
  fullName: string
  status: string
  isBanned: boolean
  createdAt: string
  lastSignIn: string
  providers: string
}

type AuditLogEntry = {
  id: string
  action: string
  createdAt: string
  actorUserId: string | null
  targetUserId: string | null
  metadata: Record<string, unknown>
}

type PracticeMemberSummary = {
  userId: string
  fullName: string
  role: string
  joinedAt: string
}

type PracticeSummary = {
  id: string
  name: string
  slug: string
  billingEmail: string | null
  currency: string
  timezone: string
  memberCount: number
  createdAt: string
  updatedAt: string
  members: PracticeMemberSummary[]
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

function getOptionalString(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== 'object') return null
  const value = (obj as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : null
}

function formatDate(value: string | Date | null) {
  if (!value) return '-'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' && value.length > 0 ? value : '-'
  }
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

async function fetchUsers(): Promise<AdminUser[]> {
  const supabaseAdmin = getSupabaseAdminClient()
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 })
  if (error) {
    throw new Error(error.message)
  }

  const users = data?.users ?? []
  const ids = users.map((user) => user.id)

  let profiles: Array<typeof schema.profiles.$inferSelect> = []
  if (ids.length) {
    profiles = await db
      .select()
      .from(schema.profiles)
      .where(inArray(schema.profiles.userId, ids))
  }

  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]))

  return users.map((user) => {
    const profile = profileMap.get(user.id)
    const banDuration = getOptionalString(user, 'ban_duration')
    const bannedUntil = getOptionalString(user, 'banned_until')
    const isBanned = Boolean(banDuration && banDuration !== 'none') || Boolean(bannedUntil)
    const status = isBanned ? 'Banned' : user.confirmed_at ? 'Active' : 'Pending'
    return {
      id: user.id,
      email: user.email ?? '-',
      fullName: profile?.fullName ?? '-',
      status,
      isBanned,
      createdAt: formatDate(user.created_at ?? ''),
      lastSignIn: formatDate(user.last_sign_in_at ?? ''),
      providers: (user.identities ?? [])
        .map((identity) => identity.provider)
        .join(', ') || 'email',
    }
  })
}

async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const rows = await db
    .select({
      id: schema.adminAuditLogs.id,
      action: schema.adminAuditLogs.action,
      actorUserId: schema.adminAuditLogs.actorUserId,
      targetUserId: schema.adminAuditLogs.targetUserId,
      metadata: schema.adminAuditLogs.metadata,
      createdAt: schema.adminAuditLogs.createdAt,
    })
    .from(schema.adminAuditLogs)
    .orderBy(desc(schema.adminAuditLogs.createdAt))
    .limit(20)

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    createdAt: formatDate(row.createdAt),
    actorUserId: row.actorUserId ?? null,
    targetUserId: row.targetUserId ?? null,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
  }))
}

async function fetchPractices(): Promise<PracticeSummary[]> {
  const practiceRows = await db
    .select({
      id: schema.practices.id,
      name: schema.practices.name,
      slug: schema.practices.slug,
      billingEmail: schema.practices.billingEmail,
      currency: schema.practices.currency,
      timezone: schema.practices.timezone,
      createdAt: schema.practices.createdAt,
      updatedAt: schema.practices.updatedAt,
      memberCount: sql<number>`count(${schema.practiceMembers.id})`,
    })
    .from(schema.practices)
    .leftJoin(schema.practiceMembers, eq(schema.practiceMembers.practiceId, schema.practices.id))
    .groupBy(schema.practices.id)
    .orderBy(desc(schema.practices.createdAt))

  if (practiceRows.length === 0) {
    return []
  }

  const practiceIds = practiceRows.map((row) => row.id)

  const memberRows = await db
    .select({
      practiceId: schema.practiceMembers.practiceId,
      userId: schema.practiceMembers.userId,
      role: schema.practiceMembers.role,
      joinedAt: schema.practiceMembers.createdAt,
      fullName: schema.profiles.fullName,
    })
    .from(schema.practiceMembers)
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.practiceMembers.userId))
    .where(inArray(schema.practiceMembers.practiceId, practiceIds))

  const membersByPractice = new Map<string, PracticeMemberSummary[]>()
  for (const row of memberRows) {
    const collection = membersByPractice.get(row.practiceId) ?? []
    collection.push({
      userId: row.userId,
      role: row.role,
      fullName: row.fullName ?? '-',
      joinedAt: formatDate(row.joinedAt),
    })
    membersByPractice.set(row.practiceId, collection)
  }

  return practiceRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    billingEmail: row.billingEmail ?? null,
    currency: row.currency ?? 'GBP',
    timezone: row.timezone ?? '-',
    memberCount: Number(row.memberCount ?? 0),
    createdAt: formatDate(row.createdAt),
    updatedAt: formatDate(row.updatedAt),
    members: membersByPractice.get(row.id) ?? [],
  }))
}
export default async function AdminPage() {
  let users: AdminUser[] = []
  let auditLogs: AuditLogEntry[] = []
  let practices: PracticeSummary[] = []
  let error: string | null = null

  try {
    ;[users, auditLogs, practices] = await Promise.all([fetchUsers(), fetchAuditLogs(), fetchPractices()])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load admin data'
  }

  return <AdminDashboard users={users} auditLogs={auditLogs} practices={practices} error={error} />
}


