'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthUser } from '@/lib/hooks/useAuthUser'

export default function Home() {
  const { user, loading } = useAuthUser()
  const router = useRouter()

  // Sign out and admin link are handled by the Header component

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
  <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Welcome to ArchiBill</h1>
  </div>
        
  <Card>
          <CardHeader>
            <CardTitle>Your Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : user ? (
              <div className="space-y-2">
                <p><span className="font-medium">Email:</span> {user.email}</p>
                <p><span className="font-medium">ID:</span> {user.id}</p>
                <p><span className="font-medium">Last Sign In:</span> {new Date(user.last_sign_in_at ?? Date.now()).toLocaleString()}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
