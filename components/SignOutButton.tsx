'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function SignOutButton() {
  const [pending, setPending] = useState(false)
  const router = useRouter()

  const onClick = async () => {
    if (pending) return
    setPending(true)
    try {
      // Ask server to clear cookies to avoid stale RSC/middleware session
      // Prefer a full redirect sign-out to ensure httpOnly cookies are cleared
      try {
        window.location.assign('/auth/signout')
        return
      } catch {
        // Fallback to POST
        try { await fetch('/auth/signout', { method: 'POST', credentials: 'include', cache: 'no-store' }) } catch {}
        await supabase.auth.signOut()
        router.replace('/auth')
        router.refresh()
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      variant="outline"
      size="sm"
      disabled={pending}
      className="transition-colors hover:bg-accent hover:text-accent-foreground"
      aria-busy={pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Signing out…
        </span>
      ) : (
        'Sign out'
      )}
    </Button>
  )
}
