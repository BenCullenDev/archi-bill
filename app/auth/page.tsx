'use client'

import { AuthForm } from '@/components/AuthForm'
import { useSearchParams } from 'next/navigation'

export default function AuthPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return (
    <div className="min-h-screen flex items-center justify-center">
      <AuthForm initialError={error} />
    </div>
  )
}
