"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter, useSearchParams } from 'next/navigation'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  useEffect(() => {
    let active = true

    const run = async () => {
      const url = new URL(window.location.href)
      const hashParams = new URLSearchParams(url.hash ? url.hash.slice(1) : '')
      const getParam = (key: string) => url.searchParams.get(key) ?? hashParams.get(key) ?? undefined
      const type = getParam('type')
      const code = getParam('code')
      const token = getParam('token')
      const accessToken = getParam('access_token')
      const refreshToken = getParam('refresh_token')

      let sessionExchanged = false

      const shouldHandleLink = type === 'recovery' || type === 'invite' || type === 'signup'

      if (shouldHandleLink) {
        if (code || token) {
          const { error } = await supabase.auth.exchangeCodeForSession(url.href)
          if (!active) return
          if (error) {
            setError(error.message ?? 'Password reset link is invalid or expired.')
            setVerifying(false)
            return
          }
          sessionExchanged = true
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (!active) return
          if (error) {
            setError(error.message ?? 'Password reset link is invalid or expired.')
            setVerifying(false)
            return
          }
          sessionExchanged = true
        }
      }

      if (sessionExchanged) {
        const cleaned = new URL(window.location.href)
        cleaned.searchParams.delete('code')
        cleaned.searchParams.delete('token')
        cleaned.searchParams.delete('type')
        cleaned.searchParams.delete('access_token')
        cleaned.searchParams.delete('refresh_token')
        cleaned.hash = ''
        window.history.replaceState({}, document.title, cleaned.toString())
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (!active) return
      setSessionReady(Boolean(session))
      setVerifying(false)
    }

    run()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return
      setSessionReady(Boolean(session))
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!sessionReady) {
      setError('Password reset session not found. Request a new link and try again.')
      return
    }

    if (password.length < 8) {
      setError('Choose a password with at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsLoading(true)
    setError(null)
    setMessage(null)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
    } else {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        console.error('Failed to sign out after password reset', signOutError)
      }
      setMessage('Password updated. Redirecting to sign in...')
      setTimeout(() => {
        router.replace(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`)
        router.refresh()
      }, 1500)
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Enter and confirm your new password to complete the reset.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              type="password"
              placeholder="New password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={verifying}
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={verifying}
            />
            <Button type="submit" disabled={verifying || isLoading}>
              {isLoading ? 'Saving...' : verifying ? 'Verifying link...' : 'Update password'}
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
