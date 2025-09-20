import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase service role credentials are not configured')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
    },
  })
}
