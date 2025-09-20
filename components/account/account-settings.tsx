"use client"

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AdminToast } from '@/components/admin/admin-toast'
import { updateProfileAction } from '@/app/account/actions'

function generateToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

type AccountSettingsProps = {
  email: string
  initialProfile: {
    fullName: string
    phone: string
  }
}

type ToastState = {
  status: 'success' | 'error'
  message: string
  token: string
}

export default function AccountSettings({ email, initialProfile }: AccountSettingsProps) {
  const [fullName, setFullName] = useState(initialProfile.fullName)
  const [phone, setPhone] = useState(initialProfile.phone)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(async () => {
      const result = await updateProfileAction({ fullName, phone })
      if (!result) return
      setToast({
        status: result.status,
        message: result.message,
        token: result.token ?? generateToken(),
      })
    })
  }

  return (
    <>
      <AdminToast status={toast?.status ?? null} message={toast?.message ?? null} token={toast?.token ?? null} />
      <Card>
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>Update your personal details so we can keep your account information accurate.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <Input value={email} disabled readOnly className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="fullName" className="text-sm font-medium text-muted-foreground">
                Full name
              </label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="e.g. Ada Lovelace"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="phone" className="text-sm font-medium text-muted-foreground">
                Phone number
              </label>
              <Input
                id="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Optional"
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
