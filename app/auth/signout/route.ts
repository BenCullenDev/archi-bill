import { NextResponse } from 'next/server'
import { cookies as nextCookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'

export const dynamic = 'force-dynamic'

async function buildSignOutResponse(request: Request) {
  // Build a response and aggressively clear Supabase auth cookies.
  const res = NextResponse.next()

  // Next 15+: cookies() may be async
  let jar: any
  try {
    // @ts-ignore support both async/sync
    jar = await (nextCookies as any)()
  } catch {
    jar = (nextCookies as any)()
  }

  // First, ask Supabase helpers to sign out and set proper cookie expirations
  try {
    const cookieStore = jar
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    await supabase.auth.signOut()
  } catch {}

  const all = (jar?.getAll?.() ?? []) as Array<{ name: string; value: string }>
  for (const c of all) {
    // Clear any Supabase-related cookies set by auth helpers
    if (c.name.startsWith('sb-')) {
      res.cookies.set(c.name, '', { path: '/', maxAge: 0 })
    }
  }

  // Some setups may use a generic token cookie name; clear just in case
  res.cookies.set('supabase-auth-token', '', { path: '/', maxAge: 0 })

  // Also clear explicit names using the project ref from NEXT_PUBLIC_SUPABASE_URL
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (url) {
      const host = new URL(url).host // e.g. etnbzyixvxeamccpkycl.supabase.co
      const ref = host.split('.')[0]
      if (ref) {
        const names = [
          `sb-${ref}-auth-token`,
          `sb-${ref}-auth-token.sig`,
          // older/alt names
          'sb-access-token',
          'sb-refresh-token',
        ]
        for (const n of names) {
          res.cookies.set(n, '', { path: '/', maxAge: 0 })
        }
      }
    }
  } catch {}

  return res
}

export async function POST(request: Request) {
  const res = await buildSignOutResponse(request)
  // For POST, send a JSON but make sure cookies are set
  const json = NextResponse.json({ success: true })
  // copy Set-Cookie headers
  const setCookies = res.headers.getSetCookie?.() ?? (res.headers as any).get?.('set-cookie')
  if (Array.isArray(setCookies)) {
    for (const sc of setCookies) json.headers.append('set-cookie', sc)
  } else if (setCookies) {
    json.headers.append('set-cookie', setCookies as any)
  }
  return json
}

export async function GET(request: Request) {
  const res = await buildSignOutResponse(request)
  // Redirect to /auth after clearing cookies
  const redirect = NextResponse.redirect(new URL('/auth', new URL(request.url).origin), 303)
  // copy Set-Cookie headers
  const setCookies = res.headers.getSetCookie?.() ?? (res.headers as any).get?.('set-cookie')
  if (Array.isArray(setCookies)) {
    for (const sc of setCookies) redirect.headers.append('set-cookie', sc)
  } else if (setCookies) {
    redirect.headers.append('set-cookie', setCookies as any)
  }
  return redirect
}
