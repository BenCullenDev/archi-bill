import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  
  // Create Supabase client
  const supabase = createMiddlewareClient({ req: request, res })

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()

  // Handle authentication
  if (!session && !request.nextUrl.pathname.startsWith('/auth')) {
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }
  // If already authenticated and on /auth, send to intended page or home
  if (session && request.nextUrl.pathname.startsWith('/auth')) {
    const dest = request.nextUrl.searchParams.get('redirectTo') || '/'
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Security headers
  const nonce = crypto.randomUUID()
  // Allow Supabase network calls (REST, Auth, Realtime) in dev/prod
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseOrigin = (() => {
    try { return supabaseUrl ? new URL(supabaseUrl).origin : '' } catch { return '' }
  })()
  const supabaseWsOrigin = supabaseOrigin
    ? supabaseOrigin.replace('https://', 'wss://').replace('http://', 'ws://')
    : ''
  const connectSrc = [
    "'self'",
    supabaseOrigin,
    supabaseWsOrigin,
  ].filter(Boolean).join(' ')
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https:;
    font-src 'self' https: data:;
    connect-src ${connectSrc};
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    block-all-mixed-content;
    upgrade-insecure-requests;
  `

  // Apply security headers
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim())
  requestHeaders.set('X-Frame-Options', 'DENY')
  requestHeaders.set('X-Content-Type-Options', 'nosniff')
  requestHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  requestHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Update response headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Set secure cookie attributes
  response.cookies.set({
    name: 'session',
    value: session?.access_token || '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: session ? 60 * 60 * 24 * 7 : 0, // 1 week or delete if no session
  })

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
