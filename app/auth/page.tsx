'use client'

import { Suspense } from 'react'
import { AuthForm } from '@/components/AuthForm'
import { useSearchParams } from 'next/navigation'

function AuthContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  return <AuthForm initialError={error} />
}

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<div>Loading...</div>}>
        <AuthContent />
      </Suspense>
    </div>
  )
}
