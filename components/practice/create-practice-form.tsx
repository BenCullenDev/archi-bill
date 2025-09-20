"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AdminToast } from '@/components/admin/admin-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { createPracticeAction } from '@/app/practice/actions'

function generateToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(0, 8)
}

type ToastState = {
  status: 'success' | 'error'
  message: string
  token: string
}

export default function CreatePracticeForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [currency, setCurrency] = useState('GBP')
  const [timezone, setTimezone] = useState('Europe/London')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await createPracticeAction({ name, billingEmail, currency, timezone })
      if (!result) return
      setToast({
        status: result.status,
        message: result.message,
        token: result.token ?? generateToken(),
      })
      if (result.status === 'success') {
        router.refresh()
      }
    })
  }

  return (
    <>
      <AdminToast status={toast?.status ?? null} message={toast?.message ?? null} token={toast?.token ?? null} />
      <Card>
        <CardHeader>
          <CardTitle>Create your practice</CardTitle>
          <CardDescription>Set up your organisation so you can add team members and start billing clients.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label htmlFor="practice-name" className="text-sm font-medium text-muted-foreground">
                Practice name
              </label>
              <Input
                id="practice-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Archi Studio"
                required
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="practice-email" className="text-sm font-medium text-muted-foreground">
                Billing email (optional)
              </label>
              <Input
                id="practice-email"
                type="email"
                value={billingEmail}
                onChange={(event) => setBillingEmail(event.target.value)}
                placeholder="accounts@example.com"
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2 md:gap-6">
              <div className="grid gap-2">
                <label htmlFor="practice-currency" className="text-sm font-medium text-muted-foreground">
                  Currency
                </label>
                <Input
                  id="practice-currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                  placeholder="ISO code e.g. GBP"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="practice-timezone" className="text-sm font-medium text-muted-foreground">
                  Timezone
                </label>
                <Input
                  id="practice-timezone"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="e.g. Europe/London"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Creating...' : 'Create practice'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
