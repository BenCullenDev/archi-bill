"use client"

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

function CallbackInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    let active = true
    const run = async () => {
      const url = new URL(window.location.href)
      // Let supabase-js handle code exchange client-side (PKCE verifier lives in browser)
      const { error } = await supabase.auth.exchangeCodeForSession(url.href)
      if (error) {
        if (!active) return
        const dest = new URL('/auth', window.location.origin)
        dest.searchParams.set('error', 'Session error')
        const redirectTo = searchParams.get('redirectTo') || '/'
        dest.searchParams.set('redirectTo', redirectTo)
        window.location.replace(dest.toString())
        return
      }

      // Wait until the auth state actually reflects SIGNED_IN (or user is present), then navigate
      const redirectTo = searchParams.get('redirectTo') || '/'

      // Quick check if user is already available
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        window.location.replace(redirectTo)
        return
      }

      // Otherwise, wait for the auth event with a short timeout fallback
      await new Promise<void>((resolve) => {
        let resolved = false
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true
            resolve()
          }
        }, 1500)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (!active) return
          if (!resolved && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
            resolved = true
            clearTimeout(timer)
            subscription.unsubscribe()
            resolve()
          }
        })
      })
  if (!active) return
  window.location.replace(redirectTo)
    }
    run()
    return () => { active = false }
  }, [router, searchParams])

  return null
}

export const dynamic = 'force-dynamic'

export default function AuthCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p>Finishing up authentication…</p>}>
        <CallbackInner />
      </Suspense>
    </div>
  )
}
