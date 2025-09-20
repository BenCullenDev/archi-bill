import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { eq } from 'drizzle-orm'
import { db, schema } from '@/db'
import AccountSettings from '@/components/account/account-settings'

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  const cookieStore = cookies()
  const supabase = createServerActionClient({ cookies: () => cookieStore })
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/auth?redirectTo=${encodeURIComponent('/account')}`)
  }

  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id))
    .limit(1)

  const initialProfile = {
    fullName: profile?.fullName ?? '',
    phone: profile?.phone ?? '',
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <AccountSettings email={user.email ?? ''} initialProfile={initialProfile} />
      </div>
    </div>
  )
}
