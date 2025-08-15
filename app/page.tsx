'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Get initial session
    const getInitialUser = async () => {
      try {
        // First check the session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError
        
        if (!session) {
          throw new Error('No session found')
        }

        // Verify the user exists
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        
        if (!user) {
          throw new Error('User not found')
        }

        setUser(user)
      } catch (error) {
        console.error('Error getting user:', error)
        // Clear any invalid session data
        await supabase.auth.signOut()
        router.push('/auth')
      } finally {
        setLoading(false)
      }
    }
    
    getInitialUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          router.push('/auth')
        } else if (session?.user) {
          try {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) throw error
            setUser(user)
          } catch (error) {
            console.error('Error in auth state change:', error)
            await supabase.auth.signOut()
            router.push('/auth')
          }
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [router])

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
            ) : (
              <p className="text-red-500">No user data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
