import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const res = NextResponse.next()
  
  // Create Supabase client
  const supabase = createMiddlewareClient({ req: request, res })

  // Refresh session if expired - required for Server Components
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null
  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = !!(
    user && (
      (adminEmail && user.email && user.email.toLowerCase() === adminEmail.toLowerCase()) ||
      // Optional: if you later store { app_metadata: { role: 'admin' } }
      (user.app_metadata && (user.app_metadata as any).role === 'admin')
    )
  )

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

  // Protect admin-only routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!session) {
      const redirectUrl = new URL('/auth', request.url)
      redirectUrl.searchParams.set('redirectTo', request.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/', request.url))
    }
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
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'unsafe-inline'", // required for Next inline hydration/scripts unless all scripts are nonced
    isDev ? "'unsafe-eval'" : '', // dev only for React Fast Refresh, etc.
  ].filter(Boolean).join(' ')
  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
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

  // Apply security headers (to request for internal handlers)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim())
  requestHeaders.set('X-Frame-Options', 'DENY')
  requestHeaders.set('X-Content-Type-Options', 'nosniff')
  requestHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  requestHeaders.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  // Also forward role to route handlers
  if (isAdmin) {
    requestHeaders.set('x-user-role', 'admin')
  } else if (session) {
    requestHeaders.set('x-user-role', 'user')
  }

  // Update response headers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Mirror headers on the response so the browser enforces them
  response.headers.set('x-nonce', nonce)
  response.headers.set('Content-Security-Policy', cspHeader.replace(/\s{2,}/g, ' ').trim())
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // Pass role information downstream if needed by server components
  if (isAdmin) {
    response.headers.set('x-user-role', 'admin')
  } else if (session) {
    response.headers.set('x-user-role', 'user')
  }

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
