import { inArray, desc } from 'drizzle-orm'
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

export default async function AdminPage() {
  let users: AdminUser[] = []
  let auditLogs: AuditLogEntry[] = []
  let error: string | null = null

  try {
    ;[users, auditLogs] = await Promise.all([fetchUsers(), fetchAuditLogs()])
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load user list'
  }

  return <AdminDashboard users={users} auditLogs={auditLogs} error={error} />
}
