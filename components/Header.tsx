import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerComponentClient, createServerActionClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export default async function Header() {
  const cookieStore = await cookies() as any
  const supabase = createServerComponentClient({ cookies: () => cookieStore })
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    // No header when not authenticated (keeps /auth minimal)
    return null
  }

  const email = session.user.email || ''
  const isAdmin = !!(process.env.ADMIN_EMAIL && email.toLowerCase() === process.env.ADMIN_EMAIL.toLowerCase())

  async function signOut() {
    'use server'
    const cookieStore = await cookies() as any
    const supabase = createServerActionClient({ cookies: () => cookieStore })
    await supabase.auth.signOut()
    redirect('/auth')
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/60 backdrop-blur supports-[backdrop-filter]:bg-background/40">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-semibold">ArchiBill</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-4 text-sm text-muted-foreground md:flex">
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
            {isAdmin && (
              <Link href="/admin" className="hover:text-foreground transition-colors">Admin</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground md:block">{email}</span>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">Sign out</Button>
          </form>
        </div>
      </div>
    </header>
  )
}
