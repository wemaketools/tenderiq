/**
 * The one browser Supabase client (brief §5.7, §10; DD-43). It is used for AUTHENTICATION ONLY: email and password
 * sign-in, password recovery, session persistence, automatic token refresh and sign-out. The browser never uses the
 * Data API, Storage or Realtime; data goes through `src/api/client.ts`.
 *
 * Built only from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (root `.env.local`, envDir = repository root).
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

function requireEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name];
  if (value === undefined || value === '') {
    throw new Error(
      `${name} is not set. Start the local Supabase stack (npm run supabase:start) and write the root .env.local ` +
        '(docs/local-development.md).',
    );
  }
  return value;
}

export const supabase: SupabaseClient = createClient(
  requireEnv('VITE_SUPABASE_URL'),
  requireEnv('VITE_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Password-recovery links land on /reset-password with the recovery session in the URL.
      detectSessionInUrl: true,
      storageKey: 'tiq.auth',
    },
  },
);

/** The current access token, read per request (supabase-js refreshes it before it expires). */
export async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
