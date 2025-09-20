import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import CreatePracticeForm from '@/components/practice/create-practice-form'
import PracticeSettings from '@/components/practice/practice-settings'

export const dynamic = 'force-dynamic'

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

export default async function PracticePage() {
  const cookieStore = cookies()
  const supabase = createServerActionClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?redirectTo=${encodeURIComponent('/practice')}`)
  }

  const membershipRows = await db
    .select({
      practiceMember: schema.practiceMembers,
      practice: schema.practices,
    })
    .from(schema.practiceMembers)
    .leftJoin(schema.practices, eq(schema.practiceMembers.practiceId, schema.practices.id))
    .where(eq(schema.practiceMembers.userId, user.id))
    .limit(1)

  const membership = membershipRows[0]
  const practice = membership?.practice ?? null
  const membershipRole = membership?.practiceMember?.role ?? null

  if (!practice) {
    return (
      <div className="min-h-screen p-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <CreatePracticeForm />
        </div>
      </div>
    )
  }

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
    .where(eq(schema.practiceMembers.practiceId, practice.id))

  const memberUserIds = memberRows.map((row) => row.userId)
  const supabaseAdmin = getSupabaseAdminClient()
  const emailMap = new Map<string, string>()
  await Promise.all(
    memberUserIds.map(async (memberId) => {
      const { data, error } = await supabaseAdmin.auth.admin.getUserById(memberId)
      if (!error && data?.user) {
        emailMap.set(memberId, data.user.email ?? '-')
      }
    })
  )

  const members = memberRows.map((row) => ({
    userId: row.userId,
    fullName: row.fullName ?? '-',
    email: emailMap.get(row.userId) ?? '-',
    role: row.role,
    joinedAt: formatDate(row.joinedAt),
  }))

  const canEditPractice = membershipRole === 'owner' || membershipRole === 'admin'
  const canManageMembers = membershipRole === 'owner'

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <PracticeSettings
          practice={{
            id: practice.id,
            name: practice.name,
            slug: practice.slug,
            billingEmail: practice.billingEmail,
            currency: practice.currency,
            timezone: practice.timezone,
          }}
          members={members}
          currentUserId={user.id}
          canEditPractice={canEditPractice}
          canManageMembers={canManageMembers}
        />
      </div>
    </div>
  )
}

