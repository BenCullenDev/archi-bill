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
    return { status: 'error', message: 'Invalid request' }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { actorId, actorEmail } = await getActorContext()

  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: mode === 'ban' ? BAN_DURATION : 'none',
    })
    if (error) throw error

    const updated = data.user as Record<string, unknown> | null
    const banDuration = typeof updated?.['ban_duration'] === 'string' ? (updated['ban_duration'] as string) : null
    const bannedUntil = typeof updated?.['banned_until'] === 'string' ? (updated['banned_until'] as string) : null

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
    return { status: 'error', message }
  }
}

export async function sendPasswordResetAction(input: {
  email: string | null
  userId?: string | null
}): Promise<ActionResult> {
  const { email, userId } = input

  if (!email) {
    return { status: 'error', message: 'Missing email' }
  }

  const supabaseAdmin = getSupabaseAdminClient()
  const { actorId, actorEmail } = await getActorContext()

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
