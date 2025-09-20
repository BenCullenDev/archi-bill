import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { ResponseCookies } from 'next/dist/server/web/spec-extension/cookies'

export const dynamic = 'force-dynamic'

type ResponseCookieValue = NonNullable<ReturnType<ResponseCookies['get']>>

const CLEAR_COOKIE_OPTIONS: Pick<ResponseCookieValue, 'path' | 'maxAge'> = {
  path: '/',
  maxAge: 0,
}

function getProjectRef(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null
  try {
    const host = new URL(supabaseUrl).host
    return host.split('.')[0] ?? null
  } catch {
    return null
  }
}

async function collectAuthCookieNames(): Promise<string[]> {
  const cookieStorePromise = cookies()
  const cookieStore = await cookieStorePromise
  const names = new Set<string>()

  cookieStore.getAll().forEach(({ name }) => {
    if (name.startsWith('sb-')) names.add(name)
  })

  names.add('supabase-auth-token')

  const projectRef = getProjectRef()
  if (projectRef) {
    names.add(`sb-${projectRef}-auth-token`)
    names.add(`sb-${projectRef}-auth-token.sig`)
  }

  try {
    const supabase = createRouteHandlerClient({ cookies: () => cookieStorePromise })
    await supabase.auth.signOut()
  } catch {
    // ignore sign-out errors; we'll still clear cookies manually
  }

  return Array.from(names)
}

function applyClearedCookies(response: NextResponse, names: string[]): void {
  names.forEach((name) => {
    response.cookies.set({ name, value: '', ...CLEAR_COOKIE_OPTIONS })
  })
}

export async function POST(): Promise<NextResponse> {
  const cookieNames = await collectAuthCookieNames()
  const json = NextResponse.json({ success: true })
  applyClearedCookies(json, cookieNames)
  return json
}

export async function GET(request: Request): Promise<NextResponse> {
  const cookieNames = await collectAuthCookieNames()
  const redirectUrl = new URL('/auth', new URL(request.url).origin)
  const response = NextResponse.redirect(redirectUrl, 303)
  applyClearedCookies(response, cookieNames)
  return response
}



