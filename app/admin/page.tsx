import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { db, schema } from '@/db'
import { inArray } from 'drizzle-orm'

function formatDate(value: string | null) {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}

async function fetchUsers() {
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
    return {
      id: user.id,
      email: user.email ?? '-',
      fullName: profile?.fullName ?? '-',
      status: user.confirmed_at ? 'Confirmed' : 'Pending',
      createdAt: formatDate(user.created_at ?? ''),
      lastSignIn: formatDate(user.last_sign_in_at ?? ''),
      providers: (user.identities ?? [])
        .map((identity) => identity.provider)
        .join(', ') || 'email',
    }
  })
}

export default async function AdminPage() {
  let users: Awaited<ReturnType<typeof fetchUsers>> = []
  let error: string | null = null

  try {
    users = await fetchUsers()
  } catch (err) {
    error = err instanceof Error ? err.message : 'Failed to load user list'
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View current users and their activity. This data is fetched with the Supabase admin API.
            </p>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle>User overview unavailable</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{error}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Ensure `SUPABASE_SERVICE_ROLE_KEY` is configured locally and in production, then reload this page.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Providers</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Last sign in</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{user.email}</td>
                      <td className="py-2 pr-4">{user.fullName}</td>
                      <td className="py-2 pr-4">{user.status}</td>
                      <td className="py-2 pr-4">{user.providers}</td>
                      <td className="py-2 pr-4">{user.createdAt}</td>
                      <td className="py-2">{user.lastSignIn}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={6}>
                        No users found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
