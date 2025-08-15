"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminPage() {
  const [email, setEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? null)
      setLoading(false)
    }
    run()
  }, [])

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
                <p>Welcome, {email ?? 'Unknown'}</p>
                <p>This page is restricted to admin users.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
