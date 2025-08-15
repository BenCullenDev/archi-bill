import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirectTo') || '/'

  const cookieStore = await cookies() as any
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore })

  // Exchange the auth code in the URL for a session
  const { error } = await supabase.auth.exchangeCodeForSession(request.url)

  if (error) {
    url.pathname = '/auth'
    url.searchParams.set('error', 'Session error')
    return NextResponse.redirect(url)
  }

  // On success, redirect to the intended destination
  return NextResponse.redirect(new URL(redirectTo, request.url))
}
