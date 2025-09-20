"use server"

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { eq, and, sql } from 'drizzle-orm'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { db, schema } from '@/db'

export type PracticeActionResult = {
  status: 'success' | 'error'
  message: string
  token?: string
}

function sanitizeInput(value: string | undefined | null, maxLength: number, { toLowerCase = false } = {}) {
  if (!value) return ''
  const trimmed = value.trim()
  const limited = trimmed.slice(0, maxLength)
  return toLowerCase ? limited.toLowerCase() : limited
}

function slugify(value: string) {
  const lower = value.toLowerCase()
  const slug = lower.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
  return slug || `practice-${randomUUID().slice(0, 8)}`
}

async function generateUniqueSlug(name: string) {
  const base = slugify(name)
  let candidate = base
  let attempt = 0
  while (attempt < 5) {
    const existing = await db
      .select({ id: schema.practices.id })
      .from(schema.practices)
      .where(eq(schema.practices.slug, candidate))
      .limit(1)
    if (existing.length === 0) {
      return candidate
    }
    candidate = `${base}-${randomUUID().slice(0, 4 + attempt)}`
    attempt += 1
  }
  return `${base}-${randomUUID().slice(0, 6)}`
}

async function getAuthContext() {
  const cookieStore = cookies()
  const supabase = createServerActionClient({ cookies: () => cookieStore })
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    user,
    error,
  }
}

function canManagePractice(role: string | null | undefined) {
  return role === 'owner' || role === 'admin'
}

export async function createPracticeAction(input: {
  name: string
  billingEmail: string
  currency: string
  timezone: string
}): Promise<PracticeActionResult> {
  const { user, error } = await getAuthContext()
  if (error || !user) {
    return { status: 'error', message: 'Not authenticated', token: randomUUID() }
  }

  const name = sanitizeInput(input.name, 120)
  const billingEmail = sanitizeInput(input.billingEmail, 255)
  const currency = sanitizeInput(input.currency || 'GBP', 10, { toLowerCase: true }).toUpperCase()
  const timezone = sanitizeInput(input.timezone || 'Europe/London', 100)

  if (!name) {
    return { status: 'error', message: 'Practice name is required', token: randomUUID() }
  }

  try {
    const slug = await generateUniqueSlug(name)
    const [practice] = await db
      .insert(schema.practices)
      .values({
        name,
        slug,
        billingEmail: billingEmail || null,
        currency: currency || 'GBP',
        timezone: timezone || 'Europe/London',
      })
      .returning()

    await db
      .insert(schema.practiceMembers)
      .values({
        practiceId: practice.id,
        userId: user.id,
        role: 'owner',
      })
      .onConflictDoNothing()

    await db
      .insert(schema.profiles)
      .values({
        userId: user.id,
        defaultPracticeId: practice.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.profiles.userId,
        set: {
          defaultPracticeId: practice.id,
          updatedAt: new Date(),
        },
      })

    await revalidatePath('/practice')
    await revalidatePath('/account')

    return { status: 'success', message: 'Practice created', token: randomUUID() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to create practice'
    return { status: 'error', message, token: randomUUID() }
  }
}

export async function updatePracticeAction(input: {
  practiceId: string
  name: string
  billingEmail: string
  currency: string
  timezone: string
}): Promise<PracticeActionResult> {
  const { user, error } = await getAuthContext()
  if (error || !user) {
    return { status: 'error', message: 'Not authenticated', token: randomUUID() }
  }

  const membership = await db
    .select({
      role: schema.practiceMembers.role,
    })
    .from(schema.practiceMembers)
    .where(
      and(
        eq(schema.practiceMembers.practiceId, input.practiceId),
        eq(schema.practiceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!membership.length || !canManagePractice(membership[0]?.role)) {
    return { status: 'error', message: 'You do not have permission to update this practice', token: randomUUID() }
  }

  const name = sanitizeInput(input.name, 120)
  const billingEmail = sanitizeInput(input.billingEmail, 255)
  const currency = sanitizeInput(input.currency || 'GBP', 10, { toLowerCase: true }).toUpperCase()
  const timezone = sanitizeInput(input.timezone || 'Europe/London', 100)

  if (!name) {
    return { status: 'error', message: 'Practice name is required', token: randomUUID() }
  }

  try {
    await db
      .update(schema.practices)
      .set({
        name,
        billingEmail: billingEmail || null,
        currency: currency || 'GBP',
        timezone: timezone || 'Europe/London',
        updatedAt: new Date(),
      })
      .where(eq(schema.practices.id, input.practiceId))

    await revalidatePath('/practice')

    return { status: 'success', message: 'Practice updated', token: randomUUID() }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to update practice'
    return { status: 'error', message, token: randomUUID() }
  }
}



const MEMBER_ROLE_OPTIONS = ['owner', 'admin', 'member', 'viewer'] as const

type PracticeMemberRole = typeof MEMBER_ROLE_OPTIONS[number]

export async function updatePracticeMemberRole(input: {
  practiceId: string
  memberUserId: string
  role: PracticeMemberRole
}): Promise<PracticeActionResult> {
  const { user, error } = await getAuthContext()
  if (error || !user) {
    return { status: 'error', message: 'Not authenticated', token: randomUUID() }
  }

  const { practiceId, memberUserId, role } = input
  if (!MEMBER_ROLE_OPTIONS.includes(role)) {
    return { status: 'error', message: 'Invalid role', token: randomUUID() }
  }

  const managerMembership = await db
    .select({ role: schema.practiceMembers.role })
    .from(schema.practiceMembers)
    .where(
      and(
        eq(schema.practiceMembers.practiceId, practiceId),
        eq(schema.practiceMembers.userId, user.id)
      )
    )
    .limit(1)

  if (!managerMembership.length || managerMembership[0].role !== 'owner') {
    return { status: 'error', message: 'Only practice owners can change member roles', token: randomUUID() }
  }

  const targetMembershipRows = await db
    .select({ role: schema.practiceMembers.role })
    .from(schema.practiceMembers)
    .where(
      and(
        eq(schema.practiceMembers.practiceId, practiceId),
        eq(schema.practiceMembers.userId, memberUserId)
      )
    )
    .limit(1)

  const targetMembership = targetMembershipRows[0]
  if (!targetMembership) {
    return { status: 'error', message: 'Member not found', token: randomUUID() }
  }

  if (targetMembership.role === role) {
    return { status: 'success', message: `Role already set to ${role}`, token: randomUUID() }
  }

  if (targetMembership.role === 'owner' && role !== 'owner') {
    const owners = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.practiceMembers)
      .where(
        and(
          eq(schema.practiceMembers.practiceId, practiceId),
          eq(schema.practiceMembers.role, 'owner')
        )
      )
      .limit(1)
    const ownerCount = Number(owners[0]?.count ?? 0)
    if (ownerCount <= 1 && memberUserId === user.id) {
      return { status: 'error', message: 'You must have at least one owner', token: randomUUID() }
    }
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

  await revalidatePath('/practice')
  await revalidatePath('/admin')

  return { status: 'success', message: `Member role updated to ${role}`, token: randomUUID() }
}


