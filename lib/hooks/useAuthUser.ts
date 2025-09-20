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
        // 1) Optimistic session read to reduce flicker
        const { data: { session } } = await supabase.auth.getSession()
        if (!active) return
        if (session?.user) setUser(session.user)

        // 2) Try to confirm with getUser()
        let { data: { user: verified } } = await supabase.auth.getUser()
        if (!active) return
        if (verified) {
          setUser(verified)
          return
        }

        // 3) Small backoff retries (covers first-login propagation)
        const delays = [150, 300, 600]
        for (const d of delays) {
          await new Promise((r) => setTimeout(r, d))
          if (!active) return
          const { data: { user: u } } = await supabase.auth.getUser()
          if (!active) return
          if (u) {
            setUser(u)
            return
          }
        }

        // 4) Wait briefly for an auth event, then confirm again
        await new Promise<void>((resolve) => {
          let done = false
          const timer = setTimeout(() => {
            if (!done) { done = true; resolve() }
          }, 1500)
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (!active || done) return
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              done = true
              clearTimeout(timer)
              subscription.unsubscribe()
              resolve()
            }
          })
        })
        if (!active) return
        ;({ data: { user: verified } } = await supabase.auth.getUser())
        if (!active) return
        if (verified) setUser(verified)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        return
      }
      // Update immediately from session if provided
      if (session?.user) setUser(session.user)
      // Confirm afterwards when tokens settle
      const { data: { user: verified } } = await supabase.auth.getUser()
      if (!active) return
      if (verified) setUser(verified)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading }
}
