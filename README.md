# ArchiBill

Billing platform for architecture practices built on Next.js, Supabase auth, and Drizzle ORM.

## Prerequisites

- Node.js 20+
- Supabase project (free tier is fine)
- A Postgres connection string with pooling enabled (`?pgbouncer=true` recommended)

## Environment setup

1. Duplicate `.env.local` and fill in the secret values:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase dashboard
   - `SUPABASE_SERVICE_ROLE_KEY` (used for admin tasks only)
   - `DATABASE_URL` in the format `postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres?pgbouncer=true&sslmode=require`
2. Never expose the service-role key or database password client-side. Keep them server-only.

## Drizzle workflow

```bash
# Generate SQL from the TypeScript schema (./db/schema.ts)
npm run db:generate

# Apply migrations to Supabase (requires DATABASE_URL)
npm run db:migrate

# Push schema directly (alternative to migrate)
npm run db:push

# Visual schema explorer
npm run db:studio
```

Generated SQL lives in `drizzle/`. Commit both the SQL files and the `meta/` snapshots so everyone stays in sync.

## Database access in code

`db/index.ts` exports a singleton Drizzle client that reuses a pooled connection and exposes the typed schema:

```ts
import { db, schema } from '@/db'
import { eq } from 'drizzle-orm'

async function listClients(practiceId: string) {
  return db.select().from(schema.clients).where(eq(schema.clients.practiceId, practiceId))
}
```

Use this in server components, route handlers, or server actions. Avoid importing it in client components because it relies on a server-side Postgres connection.

## Supabase auth bridge

- Supabase handles authentication (`@supabase/auth-helpers-nextjs` is already wired up in `middleware.ts`).
- The `profiles` table mirrors `auth.users`. Create a profile row after a new user signs up so you can join application data.
- `practice_members` links users to practices with role-based access (`owner`, `admin`, `member`, `viewer`).

## Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` and sign in via Supabase auth to exercise guarded routes.

## Next steps

- Add onboarding logic to create a `practice` and `practice_member` record when a user signs up.
- Build UI around `clients`, `projects`, and `invoices` using the generated Drizzle types.
- Consider Row Level Security (RLS) policies in Supabase that mirror the schema constraints above.

