"use client"

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { banUserAction, sendPasswordResetAction } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

type AdminDashboardProps = {
  users: AdminUser[]
  auditLogs: AuditLogEntry[]
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

function generateToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

export function AdminDashboard({ users, auditLogs, error }: AdminDashboardProps) {
  const router = useRouter()
  const [toast, setToast] = useState<ToastState | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [isRefreshing, startTransition] = useTransition()

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
              <CardTitle className="text-destructive">Unable to load users</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
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
                              disabled={isBanPending || isResetPending || isRefreshing}
                              onClick={() => handleBanToggle(user)}
                            >
                              {isBanPending ? 'Updating...' : banLabel(user)}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={isResetPending || isBanPending || user.email === '-' || isRefreshing}
                              onClick={() => handleSendReset(user)}
                            >
                              {isResetPending ? 'Sending...' : 'Send reset'}
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
                    }

                    const actionLabel =
                      log.action === 'ban'
                        ? 'Ban'
                        : log.action === 'unban'
                          ? 'Unban'
                          : log.action === 'password_reset_requested'
                            ? 'Password reset'
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
