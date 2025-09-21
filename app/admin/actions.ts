"use server"

import { eq, and, sql, inArray, isNull } from 'drizzle-orm'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { db, schema } from '@/db'

type ActionResult = {
  status: 'success' | 'error'
  message: string
  token?: string
}

const baseAppUrl =
  process.env.NEXT_PUBLIC_APP_URL || process.env.SITE_URL || 'http://localhost:3000'

const resetRedirectUrl = `${baseAppUrl.replace(/\/$/, '')}/auth/update-password`
const BAN_DURATION = '87600h'

function getOptionalString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record || typeof record !== 'object') return null
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function isUserBanned(record: Record<string, unknown> | null): boolean {
  const banDuration = getOptionalString(record, 'ban_duration')
  const bannedUntil = getOptionalString(record, 'banned_until')
  return Boolean(banDuration && banDuration !== 'none') || Boolean(bannedUntil)
}

type ActorContext = {
  actorId: string | null
  actorEmail: string | null
}

async function getActorContext(): Promise<ActorContext> {
  const cookieStore = await cookies()
  try {
    const supabase = createServerActionClient({ cookies: () => cookieStore })
    const { data } = await supabase.auth.getUser()
    return {
      actorId: data.user?.id ?? null,
      actorEmail: data.user?.email ?? null,
    }
  } catch {
    return { actorId: null, actorEmail: null }
  }
}

export async function banUserAction(input: {
  userId: string
  mode: 'ban' | 'unban'
  email?: string | null
}): Promise<ActionResult> {
  const { userId, mode, email } = input

  if (!userId || (mode !== 'ban' && mode !== 'unban')) {
    return { status: 'error', message: 'Invalid request', token: randomUUID() }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { actorId, actorEmail } = await getActorContext()

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: mode === 'ban' ? BAN_DURATION : 'none',
    })
    if (error) throw error

    const updated = data.user as Record<string, unknown> | null
    const banDuration = getOptionalString(updated, 'ban_duration')
    const bannedUntil = getOptionalString(updated, 'banned_until')

    await db.insert(schema.adminAuditLogs).values({
      action: mode === 'ban' ? 'ban' : 'unban',
      actorUserId: actorId,
      targetUserId: userId,
      metadata: {
        actorEmail,
        targetEmail: typeof email === 'string' ? email : null,
        banDuration,
        bannedUntil,
      },
    })

    await revalidatePath('/admin')

    const suffix = typeof email === 'string' && email.length > 0 ? ` ${email}` : ''
    const extra = banDuration || bannedUntil ? ` (${banDuration ?? bannedUntil})` : ''
    return {
      status: 'success',
      message: `${mode === 'ban' ? 'Banned' : 'Unbanned'}${suffix}${extra}`.trim(),
      token: randomUUID(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update user'
    return { status: 'error', message, token: randomUUID() }
  }
}

export async function sendPasswordResetAction(input: {
  email: string | null
  userId?: string | null
}): Promise<ActionResult> {
  const { email, userId } = input

  if (!email) {
    return { status: 'error', message: 'Missing email', token: randomUUID() }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { actorId, actorEmail } = await getActorContext()

  if (userId) {
    const { data: targetData, error: fetchError } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (fetchError) {
      return { status: 'error', message: fetchError.message ?? 'Unable to load user', token: randomUUID() }
    }
    const targetRecord = targetData.user as Record<string, unknown> | null
    if (isUserBanned(targetRecord)) {
      return { status: 'error', message: 'Cannot send password reset for banned users', token: randomUUID() }
    }
  }

  try {
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: resetRedirectUrl,
    })
    if (error) {
      throw error
    }

    await db.insert(schema.adminAuditLogs).values({
      action: 'password_reset_requested',
      actorUserId: actorId,
      targetUserId: userId ?? null,
      metadata: {
        actorEmail,
        targetEmail: email,
      },
    })

    await revalidatePath('/admin')

    return {
      status: 'success',
      message: `Password reset sent to ${email}`,
      token: randomUUID(),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to send password reset'
    return { status: 'error', message, token: randomUUID() }
  }
}


export async function updatePracticeMemberRoleAction(input: {
  practiceId: string
  memberUserId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
}): Promise<ActionResult> {
  const { practiceId, memberUserId, role } = input

  if (!['owner', 'admin', 'member', 'viewer'].includes(role)) {
    return { status: 'error', message: 'Invalid role', token: randomUUID() }
  }

  const { actorId, actorEmail } = await getActorContext()

  const existingRows = await db
    .select({ role: schema.practiceMembers.role })
    .from(schema.practiceMembers)
    .where(
      and(
        eq(schema.practiceMembers.practiceId, practiceId),
        eq(schema.practiceMembers.userId, memberUserId)
      )
    )
    .limit(1)

  const existing = existingRows[0]
  if (!existing) {
    return { status: 'error', message: 'Member not found', token: randomUUID() }
  }

  if (existing.role === role) {
    return { status: 'success', message: `Role already set to ${role}`, token: randomUUID() }
  }

  if (existing.role === 'owner' && role !== 'owner') {
    const owners = await db
      .select({ count: sql<number>`count(${schema.practiceMembers.id})` })
      .from(schema.practiceMembers)
      .where(
        and(
          eq(schema.practiceMembers.practiceId, practiceId),
          eq(schema.practiceMembers.role, 'owner')
        )
      )
      .limit(1)
    const ownerCount = Number(owners[0]?.count ?? 0)
    if (ownerCount <= 1) {
      return { status: 'error', message: 'A practice must have at least one owner', token: randomUUID() }
    }
  }

  await db
    .update(schema.practiceMembers)
    .set({ role })
    .where(
      and(
        eq(schema.practiceMembers.practiceId, practiceId),
        eq(schema.practiceMembers.userId, memberUserId)
      )
    )

  await db.insert(schema.adminAuditLogs).values({
    action: 'practice_member_role_updated',
    actorUserId: actorId,
    targetUserId: memberUserId,
    metadata: {
      actorEmail,
      practiceId,
      previousRole: existing.role,
      newRole: role,
    },
  })

  await revalidatePath('/admin')
  await revalidatePath('/practice')

  return { status: 'success', message: `Member role updated to ${role}`, token: randomUUID() }
}






export async function deleteUserAction(input: { userId: string }): Promise<ActionResult> {
  const { userId } = input

  if (!userId) {
    return { status: 'error', message: 'User ID is required', token: randomUUID() }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { actorId, actorEmail } = await getActorContext()

  if (actorId && actorId === userId) {
    return { status: 'error', message: 'You cannot delete your own account', token: randomUUID() }
  }

  let targetEmail: string | null = null
  let userWasFound = true
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error) {
      const message = error.message ?? 'Unable to load user details'
      if (!message.toLowerCase().includes('not found')) {
        return { status: 'error', message, token: randomUUID() }
      }
      userWasFound = false
    } else {
      targetEmail = (data?.user?.email ?? null) as string | null
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load user details'
    return { status: 'error', message, token: randomUUID() }
  }

  const memberships = await db
    .select({
      practiceId: schema.practiceMembers.practiceId,
      role: schema.practiceMembers.role,
      practiceName: schema.practices.name,
    })
    .from(schema.practiceMembers)
    .leftJoin(schema.practices, eq(schema.practiceMembers.practiceId, schema.practices.id))
    .where(eq(schema.practiceMembers.userId, userId))

  const ownerPracticeIds = Array.from(
    new Set(
      memberships
        .filter((membership) => membership.role === 'owner')
        .map((membership) => membership.practiceId)
        .filter((practiceId): practiceId is string => Boolean(practiceId))
    )
  )

  if (ownerPracticeIds.length > 0) {
    const ownerCounts = await db
      .select({
        practiceId: schema.practiceMembers.practiceId,
        ownerCount: sql<number>`count(${schema.practiceMembers.id})`,
      })
      .from(schema.practiceMembers)
      .where(
        and(
          inArray(schema.practiceMembers.practiceId, ownerPracticeIds),
          eq(schema.practiceMembers.role, 'owner')
        )
      )
      .groupBy(schema.practiceMembers.practiceId)

    const ownerCountMap = new Map(ownerCounts.map((row) => [row.practiceId, Number(row.ownerCount ?? 0)]))
    const soleOwnerPracticeIds = ownerPracticeIds.filter((practiceId) => (ownerCountMap.get(practiceId) ?? 0) <= 1)

    if (soleOwnerPracticeIds.length > 0) {
      const practiceRows = await db
        .select({ id: schema.practices.id, name: schema.practices.name })
        .from(schema.practices)
        .where(inArray(schema.practices.id, soleOwnerPracticeIds))

      const practiceNames = practiceRows.map((row) => row.name).filter((name): name is string => Boolean(name))
      const list = practiceNames.length ? practiceNames.join(', ') : 'their practice'
      return {
        status: 'error',
        message: `Cannot delete user while they are the sole owner of ${list}. Transfer ownership first.`,
        token: randomUUID(),
      }
    }
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (error) {
      const message = error.message ?? 'Unable to delete user'
      if (!message.toLowerCase().includes('not found')) {
        return { status: 'error', message, token: randomUUID() }
      }
      userWasFound = false
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete user'
    return { status: 'error', message, token: randomUUID() }
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.practiceMembers).where(eq(schema.practiceMembers.userId, userId))

    await tx
      .update(schema.practiceInvites)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.practiceInvites.supabaseUserId, userId),
          isNull(schema.practiceInvites.acceptedAt),
          isNull(schema.practiceInvites.revokedAt)
        )
      )

    await tx
      .update(schema.practiceInvites)
      .set({ supabaseUserId: null })
      .where(eq(schema.practiceInvites.supabaseUserId, userId))

    await tx.delete(schema.profiles).where(eq(schema.profiles.userId, userId))
  })

  await db.insert(schema.adminAuditLogs).values({
    action: 'user_deleted',
    actorUserId: actorId,
    targetUserId: userId,
    metadata: {
      actorEmail,
      targetEmail,
      userWasFound,
      memberships: memberships.map((membership) => ({
        practiceId: membership.practiceId,
        practiceName: membership.practiceName,
        role: membership.role,
      })),
    },
  })

  await revalidatePath('/admin')
  await revalidatePath('/practice')

  const suffix = targetEmail ? ` ${targetEmail}` : ''
  return { status: 'success', message: `Deleted${suffix}`.trim(), token: randomUUID() }
}

