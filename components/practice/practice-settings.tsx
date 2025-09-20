"use client"

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { AdminToast } from '@/components/admin/admin-toast'
import { invitePracticeMember, updatePracticeAction, updatePracticeMemberRole } from '@/app/practice/actions'

function generateToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(0, 8)
}

type PracticeMemberRole = 'owner' | 'admin' | 'member' | 'viewer'
const ROLE_OPTIONS: PracticeMemberRole[] = ['owner', 'admin', 'member', 'viewer']

type PracticeSettingsProps = {
  practice: {
    id: string
    name: string
    slug: string
    billingEmail: string | null
    currency: string
    timezone: string
  }
  members: Array<{
    userId: string
    fullName: string
    email: string
    role: string
    joinedAt: string
  }>
  invites: Array<{
    id: string
    email: string
    role: string
    status: string
    createdAt: string
  }>
  currentUserId: string
  canEditPractice: boolean
  canManageMembers: boolean
}

type ToastState = {
  status: 'success' | 'error'
  message: string
  token: string
}

export default function PracticeSettings({
  practice,
  members,
  invites,
  currentUserId,
  canEditPractice,
  canManageMembers,
}: PracticeSettingsProps) {
  const router = useRouter()
  const [name, setName] = useState(practice.name)
  const [billingEmail, setBillingEmail] = useState(practice.billingEmail ?? '')
  const [currency, setCurrency] = useState(practice.currency || 'GBP')
  const [timezone, setTimezone] = useState(practice.timezone || 'Europe/London')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [isPending, startTransition] = useTransition()
  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<PracticeMemberRole>('member')
  const [isInvitePending, setIsInvitePending] = useState(false)

  useEffect(() => {
    setName(practice.name)
    setBillingEmail(practice.billingEmail ?? '')
    setCurrency(practice.currency || 'GBP')
    setTimezone(practice.timezone || 'Europe/London')
  }, [practice.id, practice.name, practice.billingEmail, practice.currency, practice.timezone])

  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      const aIndex = ROLE_OPTIONS.indexOf((a.role as PracticeMemberRole) ?? 'member')
      const bIndex = ROLE_OPTIONS.indexOf((b.role as PracticeMemberRole) ?? 'member')
      return aIndex - bIndex
    })
  }, [members])

  const handlePracticeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEditPractice) return

    startTransition(async () => {
      try {
        const result = await updatePracticeAction({
          practiceId: practice.id,
          name,
          billingEmail,
          currency,
          timezone,
        })
        if (!result) return
        setToast({
          status: result.status,
          message: result.message,
          token: result.token ?? generateToken(),
        })
        if (result.status === 'success') {
          router.refresh()
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update practice'
        setToast({ status: 'error', message, token: generateToken() })
      }
    })
  }

  const handleMemberRoleChange = (userId: string, role: PracticeMemberRole) => {
    if (!canManageMembers || userId === currentUserId) return

    setPendingMemberId(userId)
    startTransition(async () => {
      try {
        const result = await updatePracticeMemberRole({
          practiceId: practice.id,
          memberUserId: userId,
          role,
        })
        if (result) {
          setToast({
            status: result.status,
            message: result.message,
            token: result.token ?? generateToken(),
          })
          if (result.status === 'success') {
            router.refresh()
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to update member role'
        setToast({ status: 'error', message, token: generateToken() })
      } finally {
        setPendingMemberId(null)
      }
    })
  }

  const handleInviteSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canManageMembers) return

    if (!inviteEmail.trim()) {
      setToast({ status: 'error', message: 'Invite email is required', token: generateToken() })
      return
    }

    setIsInvitePending(true)
    startTransition(async () => {
      try {
        const result = await invitePracticeMember({
          practiceId: practice.id,
          email: inviteEmail,
          role: inviteRole,
        })
        if (result) {
          setToast({
            status: result.status,
            message: result.message,
            token: result.token ?? generateToken(),
          })
          if (result.status === 'success') {
            setInviteEmail('')
            setInviteRole('member')
            router.refresh()
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to send invite'
        setToast({ status: 'error', message, token: generateToken() })
      } finally {
        setIsInvitePending(false)
      }
    })
  }

  return (
    <>
      <AdminToast status={toast?.status ?? null} message={toast?.message ?? null} token={toast?.token ?? null} />
      <Card>
        <CardHeader>
          <CardTitle>Practice settings</CardTitle>
          <CardDescription>Manage how your practice appears to clients and teammates.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handlePracticeSubmit}>
            <div className="grid gap-2">
              <label className="text-sm font-medium text-muted-foreground">Practice slug</label>
              <Input value={practice.slug} readOnly disabled className="bg-muted text-muted-foreground" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="practice-name" className="text-sm font-medium text-muted-foreground">
                Practice name
              </label>
              <Input
                id="practice-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={!canEditPractice || isPending}
                placeholder="e.g. Archi Studio"
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
                disabled={!canEditPractice || isPending}
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
                  disabled={!canEditPractice || isPending}
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
                  disabled={!canEditPractice || isPending}
                  placeholder="e.g. Europe/London"
                />
              </div>
            </div>
            <div className="flex items-center justify-end">
              <Button type="submit" disabled={!canEditPractice || isPending}>
                {isPending ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {canManageMembers
              ? 'Update roles for teammates in your practice.'
              : 'Only practice owners can change member roles.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {canManageMembers && (
            <form
              className="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end"
              onSubmit={handleInviteSubmit}
            >
              <div className="grid gap-2">
                <label htmlFor="invite-email" className="text-sm font-medium text-muted-foreground">
                  Invite email
                </label>
                <Input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="person@example.com"
                  disabled={isInvitePending}
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="invite-role" className="text-sm font-medium text-muted-foreground">
                  Role
                </label>
                <select
                  id="invite-role"
                  className="min-w-[140px] rounded border bg-background px-2 py-1"
                  value={inviteRole}
                  onChange={(event) => setInviteRole(event.target.value as PracticeMemberRole)}
                  disabled={isInvitePending}
                >
                  {ROLE_OPTIONS.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isInvitePending || inviteEmail.trim().length === 0}>
                  {isInvitePending ? 'Sending...' : 'Send invite'}
                </Button>
              </div>
            </form>
          )}

          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet.</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((member) => {
                  const canEditRole = canManageMembers && member.userId !== currentUserId
                  const isPendingMember = pendingMemberId === member.userId

                  return (
                    <tr key={member.userId} className="border-b last:border-none">
                      <td className="py-2 pr-4 font-medium">{member.fullName || member.email}</td>
                      <td className="py-2 pr-4">{member.email}</td>
                      <td className="py-2 pr-4">
                        <select
                          className="rounded border bg-background px-2 py-1"
                          value={member.role}
                          onChange={(event) =>
                            handleMemberRoleChange(member.userId, event.target.value as PracticeMemberRole)
                          }
                          disabled={!canEditRole || isPendingMember}
                        >
                          {ROLE_OPTIONS.map((roleOption) => (
                            <option key={roleOption} value={roleOption}>
                              {roleOption.charAt(0).toUpperCase() + roleOption.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 text-muted-foreground">{member.joinedAt}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {invites.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground">Invitations</h3>
              <table className="mt-2 min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2">Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((invite) => (
                    <tr key={invite.id} className="border-b last:border-none">
                      <td className="py-2 pr-4">{invite.email}</td>
                      <td className="py-2 pr-4">
                        {invite.role.charAt(0).toUpperCase() + invite.role.slice(1)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{invite.status}</td>
                      <td className="py-2 text-muted-foreground">{invite.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
