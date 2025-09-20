"use server"

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { db, schema } from '@/db'

export type ProfileActionResult = {
  status: 'success' | 'error'
  message: string
  token?: string
}

function sanitizeInput(value: string | undefined | null, maxLength: number) {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.slice(0, maxLength)
}

export async function updateProfileAction(input: {
  fullName: string
  phone: string
}): Promise<ProfileActionResult> {
  const fullName = sanitizeInput(input.fullName, 200)
  const phone = sanitizeInput(input.phone, 50)

  const cookieStore = cookies()
  const supabase = createServerActionClient({ cookies: () => cookieStore })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { status: 'error', message: 'Not authenticated', token: randomUUID() }
  }

  const now = new Date()

  try {
    await db
      .insert(schema.profiles)
      .values({
        userId: user.id,
        fullName: fullName || null,
        phone: phone || null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.profiles.userId,
        set: {
          fullName: fullName || null,
          phone: phone || null,
          updatedAt: now,
        },
      })

    await revalidatePath('/account')

    return { status: 'success', message: 'Profile updated successfully', token: randomUUID() }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update profile'
    return { status: 'error', message, token: randomUUID() }
  }
}
