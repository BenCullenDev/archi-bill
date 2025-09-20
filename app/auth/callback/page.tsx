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
      const hashParams = new URLSearchParams(url.hash ? url.hash.slice(1) : '')
      const redirectTo = searchParams.get('redirectTo') || hashParams.get('redirect_to') || '/'
      const next = searchParams.get('next') || hashParams.get('next')

      const { error } = await supabase.auth.exchangeCodeForSession(url.href)
      if (!active) return

      if (error) {
        const dest = new URL('/auth', window.location.origin)
        dest.searchParams.set('error', 'Session error')
        dest.searchParams.set('redirectTo', redirectTo)
        window.location.replace(dest.toString())
        return
      }

      if (next) {
        window.location.replace(new URL(next, window.location.origin).toString())
        return
      }

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
      <Suspense fallback={<p>Finishing up authentication...</p>}>
        <CallbackInner />
      </Suspense>
    </div>
  )
}
