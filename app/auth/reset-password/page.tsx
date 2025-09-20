"use client"

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter, useSearchParams } from 'next/navigation'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setError(null)
    setMessage(null)

    const updateUrl = new URL('/auth/update-password', window.location.origin)
    updateUrl.searchParams.set('redirectTo', redirectTo)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: updateUrl.toString(),
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage("If the email exists we've sent password reset instructions.")
    }

    setIsLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            {"Enter your account email and we'll email you a reset link."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <Input
              type="email"
              placeholder="Email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
            />
            <div className="flex flex-col space-y-2">
              <Button type="submit" disabled={isLoading || !email}>
                {isLoading ? 'Sending...' : 'Send reset link'}
              </Button>
              <Button
                type="button"
                variant="link"
                className="px-0 self-start text-sm"
                onClick={() => router.push(`/auth?redirectTo=${encodeURIComponent(redirectTo)}`)}
              >
                Back to sign in
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {message && <p className="text-sm text-muted-foreground">{message}</p>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
