"use client"

import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastStatus = 'success' | 'error'

type AdminToastProps = {
  status: ToastStatus | null
  message: string | null
  token: string | null
}

type ToastState = {
  id: string
  status: ToastStatus
  message: string
}

export function AdminToast({ status, message, token }: AdminToastProps) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!status || !message || !token) {
      return
    }

    setToast({ id: token, status, message })
    setOpen(true)
  }, [status, message, token])

  useEffect(() => {
    if (!toast || !open) {
      return
    }

    const timer = window.setTimeout(() => {
      setOpen(false)
    }, 4500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [toast, open])

  if (!toast || !open) {
    return null
  }

  const isError = toast.status === 'error'

  const handleDismiss = () => {
    setOpen(false)
  }

  return (
    <div className="pointer-events-none fixed right-6 top-6 z-50 flex max-w-sm flex-col gap-3">
      <div
        className={cn(
          'pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg ring-1 ring-black/5 transition focus:outline-none focus-visible:ring-2 dark:ring-white/10',
          isError ? 'border-destructive/50' : 'border-emerald-500/40'
        )}
        role="status"
        aria-live="polite"
      >
        <div className={cn('mt-0.5', isError ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
          {isError ? <AlertCircle className="h-5 w-5" aria-hidden /> : <CheckCircle2 className="h-5 w-5" aria-hidden />}
        </div>
        <div className="flex-1 text-sm leading-5 text-card-foreground">
          {toast.message}
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}





