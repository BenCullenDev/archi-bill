"use client"

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { banUserAction, deleteUserAction, sendPasswordResetAction, updatePracticeMemberRoleAction } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AdminToast } from '@/components/admin/admin-toast'

type AdminUser = {
  id: string
  email: string
  fullName: string
  status: string
  isBanned: boolean
  createdAt: string
  lastSignIn: string
  providers: string
}

type AuditLogEntry = {
  id: string
  action: string
  createdAt: string
  actorUserId: string | null
  targetUserId: string | null
  metadata: Record<string, unknown>
}

type PracticeMemberSummary = {
  userId: string
  fullName: string
  role: string
  joinedAt: string
}

type PracticeSummary = {
  id: string
  name: string
  slug: string
  billingEmail: string | null
  currency: string
  timezone: string
  memberCount: number
  createdAt: string
  updatedAt: string
  members: PracticeMemberSummary[]
}

type AdminDashboardProps = {
  users: AdminUser[]
  auditLogs: AuditLogEntry[]
  practices: PracticeSummary[]
  error: string | null
}

type ToastState = {
  status: 'success' | 'error'
  message: string
  token: string
}

type PendingAction = {
  type: 'ban' | 'reset'
  userId: string
}

type PendingMemberRole = {
  practiceId: string
  userId: string
} | null

type PracticeMemberRole = 'owner' | 'admin' | 'member' | 'viewer'

const ROLE_OPTIONS: PracticeMemberRole[] = ['owner', 'admin', 'member', 'viewer']

function generateToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export function AdminDashboard({ users, auditLogs, practices, error }: AdminDashboardProps) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [pendingMemberRole, setPendingMemberRole] = useState<PendingMemberRole>(null)
  const [isRefreshing, startTransition] = useTransition()

  const userById = useMemo(() => {
    const map = new Map<string, AdminUser>()
    users.forEach((user) => map.set(user.id, user))
    return map
  }, [users])

  const showToast = (status: 'success' | 'error', message: string, token?: string) => {
    setToast({ status, message, token: token ?? generateToken() })
  }

  const handleBanToggle = async (user: AdminUser) => {
    setPendingAction({ type: 'ban', userId: user.id })
    try {
      const result = await banUserAction({
        userId: user.id,
        mode: user.isBanned ? 'unban' : 'ban',
        email: user.email !== '-' ? user.email : null,
      })

      if (result) {
        showToast(result.status, result.message, result.token)
        if (result.status === 'success') {
          startTransition(() => router.refresh())
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update user'
      showToast('error', message)
    } finally {
      setPendingAction(null)
    }
  }

  const handleSendReset = async (user: AdminUser) => {
    if (user.isBanned) {
      showToast('error', 'Cannot send password reset for banned users')
      return
    }
    setPendingAction({ type: 'reset', userId: user.id })
    try {
      const result = await sendPasswordResetAction({
        email: user.email !== '-' ? user.email : null,
        userId: user.id,
      })

      if (result) {
        showToast(result.status, result.message, result.token)
        if (result.status === 'success') {
          startTransition(() => router.refresh())
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send password reset'
      showToast('error', message)
    } finally {
      setPendingAction(null)
    }
  }

  const handleDeleteUser = async (user: AdminUser) => {
    const emailLabel = user.email !== '-' ? user.email : 'this account'
    const confirmed = window.confirm(`Permanently delete ${emailLabel}? This cannot be undone.`)
    if (!confirmed) return

    setPendingAction({ type: 'delete', userId: user.id })
    try {
      const result = await deleteUserAction({ userId: user.id })

      if (result) {
        showToast(result.status, result.message, result.token)
        if (result.status === 'success') {
          startTransition(() => router.refresh())
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to delete user'
      showToast('error', message)
    } finally {
      setPendingAction(null)
    }
  }

  const handleMemberRoleChange = (practiceId: string, memberId: string, nextRole: PracticeMemberRole) => {
    setPendingMemberRole({ practiceId, userId: memberId })
    startTransition(async () => {
      const result = await updatePracticeMemberRoleAction({
        practiceId,
        memberUserId: memberId,
        role: nextRole,
      })
      if (result) {
        showToast(result.status, result.message, result.token)
        if (result.status === 'success') {
          router.refresh()
        }
      }
      setPendingMemberRole(null)
    })
  }

  const banLabel = (user: AdminUser) => (user.isBanned ? 'Unban' : 'Ban')

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <AdminToast
          status={toast?.status ?? null}
          message={toast?.message ?? null}
          token={toast?.token ?? null}
        />

        <Card>
          <CardHeader>
            <CardTitle>Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View and manage users. Actions below use the Supabase admin API.
            </p>
          </CardContent>
        </Card>

        {error ? (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Unable to load data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Users ({users.length})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Providers</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2 pr-4">Last sign in</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isBanPending = pendingAction?.type === 'ban' && pendingAction.userId === user.id
                    const isResetPending = pendingAction?.type === 'reset' && pendingAction.userId === user.id
                    const isDeletePending = pendingAction?.type === 'delete' && pendingAction.userId === user.id

                    return (
                      <tr key={user.id} className="border-b last:border-none">
                        <td className="py-2 pr-4 font-medium">{user.email}</td>
                        <td className="py-2 pr-4">{user.fullName}</td>
                        <td className="py-2 pr-4">{user.status}</td>
                        <td className="py-2 pr-4">{user.providers}</td>
                        <td className="py-2 pr-4">{user.createdAt}</td>
                        <td className="py-2 pr-4">{user.lastSignIn}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant={user.isBanned ? 'outline' : 'destructive'}
                              disabled={isBanPending || isResetPending || isDeletePending || isRefreshing}
                              onClick={() => handleBanToggle(user)}
                            >
                              {isBanPending ? 'Updating...' : banLabel(user)}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={isResetPending || isBanPending || isDeletePending || user.email === '-' || user.isBanned || isRefreshing}
                              onClick={() => handleSendReset(user)}
                            >
                              {isResetPending ? 'Sending...' : user.isBanned ? 'Reset disabled' : 'Send reset'}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={isDeletePending || isBanPending || isResetPending || isRefreshing}
                              onClick={() => handleDeleteUser(user)}
                            >
                              {isDeletePending ? 'Deleting...' : 'Delete'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td className="py-6 text-center text-muted-foreground" colSpan={7}>
                        No users found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Practices ({practices.length})</CardTitle>
            <CardDescription>Overview of organisations and their members.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {practices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No practices created yet.</p>
            ) : (
              practices.map((practice) => {
                const sortedMembers = [...practice.members].sort((a, b) =>
                  ROLE_OPTIONS.indexOf((a.role as PracticeMemberRole) ?? 'member') -
                  ROLE_OPTIONS.indexOf((b.role as PracticeMemberRole) ?? 'member')
                )

                return (
                  <div key={practice.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-1 pb-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-base font-semibold">{practice.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          Slug: {practice.slug}  Currency: {practice.currency}  Timezone: {practice.timezone}
                        </p>
                        {practice.billingEmail && (
                          <p className="text-sm text-muted-foreground">Billing email: {practice.billingEmail}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Created {practice.createdAt}  Updated {practice.updatedAt}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {practice.memberCount} member{practice.memberCount === 1 ? '' : 's'}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
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
                              const userDetails = userById.get(member.userId)
                              const email = userDetails?.email ?? '-'
                              const pending =
                                pendingMemberRole?.practiceId === practice.id &&
                                pendingMemberRole.userId === member.userId

                              return (
                                <tr key={member.userId} className="border-b last:border-none">
                                  <td className="py-2 pr-4 font-medium">{member.fullName || email}</td>
                                  <td className="py-2 pr-4">{email}</td>
                                  <td className="py-2 pr-4">
                                    <select
                                      className="rounded border bg-background px-2 py-1"
                                      value={member.role}
                                      onChange={(event) =>
                                        handleMemberRoleChange(
                                          practice.id,
                                          member.userId,
                                          event.target.value as PracticeMemberRole
                                        )
                                      }
                                      disabled={isRefreshing || pending}
                                    >
                                      {ROLE_OPTIONS.map((option) => (
                                        <option key={option} value={option}>
                                          {option.charAt(0).toUpperCase() + option.slice(1)}
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
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent admin activity</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="border-b text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">When</th>
                    <th className="py-2 pr-4">Action</th>
                    <th className="py-2 pr-4">Actor</th>
                    <th className="py-2 pr-4">Target</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => {
                    const metadata = log.metadata || {}
                    const actorLabel =
                      (typeof metadata.actorEmail === 'string' && metadata.actorEmail) || log.actorUserId || '-'
                    const targetLabel =
                      (typeof metadata.targetEmail === 'string' && metadata.targetEmail) || log.targetUserId || '-'

                    let notes = ''
                    if (log.action === 'ban') {
                      const banDuration = metadata.banDuration as string | null | undefined
                      const bannedUntil = metadata.bannedUntil as string | null | undefined
                      if (banDuration && banDuration !== 'none') {
                        notes = `Ban duration: ${banDuration}`
                      } else if (bannedUntil) {
                        notes = `Banned until: ${bannedUntil}`
                      }
                    } else if (log.action === 'unban') {
                      notes = 'Ban lifted'
                    } else if (log.action === 'password_reset_requested') {
                      notes = 'Reset email sent'
                    } else if (log.action === 'practice_member_role_updated') {
                      const newRole = metadata.newRole as string | undefined
                      const previousRole = metadata.previousRole as string | undefined
                      notes = newRole ? `Role: ${previousRole ?? '-'} -> ${newRole}` : 'Member role updated'
                    }

                    const actionLabel =
                      log.action === 'ban'
                        ? 'Ban'
                        : log.action === 'unban'
                          ? 'Unban'
                          : log.action === 'password_reset_requested'
                            ? 'Password reset'
                            : log.action === 'practice_member_role_updated'
                              ? 'Practice member role'
                              : log.action

                    return (
                      <tr key={log.id} className="border-b last:border-none">
                        <td className="py-2 pr-4">{log.createdAt}</td>
                        <td className="py-2 pr-4">{actionLabel}</td>
                        <td className="py-2 pr-4">{actorLabel}</td>
                        <td className="py-2 pr-4">{targetLabel}</td>
                        <td className="py-2 text-muted-foreground">{notes || '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


