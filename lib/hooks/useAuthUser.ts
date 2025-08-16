"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export function useAuthUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        // First, get current session and optimistically set user to avoid flicker
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return
        if (session?.user) setUser(session.user)

        // Confirm with a trusted getUser() call
        const { data: { user: verified } } = await supabase.auth.getUser()
        if (!active) return
        if (verified) {
          setUser(verified)
          return
        }

        // One short retry to cover first-login race
        await new Promise((r) => setTimeout(r, 300))
        const { data: { user: verifiedRetry } } = await supabase.auth.getUser()
        if (!active) return
        if (verifiedRetry) setUser(verifiedRetry)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return
      // Update immediately from session if provided
      if (session?.user) setUser(session.user)
      // Then confirm from auth server
      const { data: { user: verified } } = await supabase.auth.getUser()
      if (!active) return
      setUser(verified ?? null)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
