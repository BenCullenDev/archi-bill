'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter, useSearchParams } from 'next/navigation'

interface AuthFormProps {
  initialError?: string | null
}

export function AuthForm({ initialError }: AuthFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(initialError || null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setError('Check your email for the confirmation link.')
    }
    setIsLoading(false)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      // On success, navigate to the original destination or home
      router.replace(redirectTo)
      router.refresh()
    }
    setIsLoading(false)
  }

  return (
    <Card className="w-[400px]">
      <CardHeader>
        <CardTitle>Welcome to ArchiBill</CardTitle>
        <CardDescription>Sign in or create a new account</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="flex flex-col space-y-2">
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            variant="default"
          >
            {isLoading ? 'Signing in…' : 'Sign In'}
          </Button>
          <Button
            onClick={handleSignUp}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? 'Signing up…' : 'Sign Up'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
