/**
 * Server-side supabase-js clients (architecture brief §5.7).
 *
 * Both clients are memoized per (url, key) and never keep a session: `persistSession`, `autoRefreshToken` and
 * `detectSessionInUrl` are off, so one instance can serve concurrent requests of different users.
 * - The VERIFICATION client uses the anon key and is used only for `auth.getClaims(token, { jwks })`.
 * - The ADMIN client uses the service-role key: the Auth Admin API (user provisioning; `npm run auth:personas` in
 *   Stage A) and, from Stage B, Storage. It never leaves the server.
 */
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getConfig } from '../config/index.js';
import type { AppConfig } from '../config/index.js';

const SERVER_AUTH_OPTIONS = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
} as const;

const clients = new Map<string, SupabaseClient>();

/** A memoized server client for (url, key). */
export function getSupabaseClient(url: string, key: string): SupabaseClient {
  const cacheKey = `${url}\u0000${key}`;
  let client = clients.get(cacheKey);
  if (client === undefined) {
    client = createClient(url, key, SERVER_AUTH_OPTIONS);
    clients.set(cacheKey, client);
  }
  return client;
}

/** The anon-key client used only for token verification (`getClaims`). */
export function getVerificationClient(config: AppConfig = getConfig()): SupabaseClient {
  return getSupabaseClient(config.supabase.url, config.supabase.anonKey);
}

/** The service-role client for the Auth Admin API (and Storage from Stage B). Server only. */
export function getAdminClient(config: AppConfig = getConfig()): SupabaseClient {
  return getSupabaseClient(config.supabase.url, config.supabase.serviceRoleKey);
}

/** Forgets every memoized client (tests only). */
export function resetSupabaseClients(): void {
  clients.clear();
}
