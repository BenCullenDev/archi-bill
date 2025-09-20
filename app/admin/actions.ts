"use server"

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
  const cookieStore = cookies()
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
