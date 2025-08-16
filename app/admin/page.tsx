"use client"

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthUser } from '@/lib/hooks/useAuthUser'

export default function AdminPage() {
  const { user, loading } = useAuthUser()
  const router = useRouter()

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
          </CardHeader>
          <CardContent>
      {loading ? 'Loading…' : (
              <div className="space-y-2">
        <p>Welcome, {user?.email ?? 'Unknown'}</p>
                <p>This page is restricted to admin users.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
