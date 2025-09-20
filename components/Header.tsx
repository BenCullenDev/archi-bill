import Link from 'next/link'
import { headers } from 'next/headers'
import SignOutButton from '@/components/SignOutButton'

export default async function Header() {
  const h = await headers()
  if (h.get('x-hide-header') === '1') return null
  const role = h.get('x-user-role')
  if (!role) {
    // No header when not authenticated (keeps /auth minimal)
    return null
  }
  const isAdmin = role === 'admin'

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
          <Link href="/practice" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Practice</Link>
          <Link href="/account" className="text-sm text-muted-foreground transition-colors hover:text-foreground">Account</Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}

