/**
 * JWKS cache for token verification (architecture brief §5.7 step 3).
 *
 * The public signing keys of Supabase Auth are fetched from `<url>/auth/v1/.well-known/jwks.json` and cached.
 * - A key id that is not in a FRESH cache is rejected WITHOUT a network round-trip, so forged `kid` values cannot
 *   be used to make the server hammer the Auth endpoint.
 * - The set is re-fetched only when it is empty or older than `ttlMs` (default 10 minutes; key rotation becomes
 *   effective within that window). Concurrent refreshes share one request (single flight).
 * - A failed refresh keeps the previous set until it is older than `maxStaleMs` (default 1 hour), so a short Auth
 *   outage does not reject valid sessions. With no usable set, `getKey` throws `JwksUnavailableError`.
 * - Only asymmetric public keys (`kty` EC or RSA, no private members) are ever kept.
 */
import type { JWK } from '@supabase/supabase-js';

import { getConfig } from '../config/index.js';
import type { AppConfig } from '../config/index.js';

export type { JWK } from '@supabase/supabase-js';

/** No JWKS could be obtained (the Auth endpoint is unreachable and nothing usable is cached). */
export class JwksUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'JwksUnavailableError';
  }
}

export interface JwksCacheOptions {
  readonly url: string;
  /** Injected for tests. Defaults to the global fetch. */
  readonly fetch?: typeof fetch;
  /** Injected for tests. Defaults to `Date.now`. */
  readonly now?: () => number;
  readonly ttlMs?: number;
  readonly maxStaleMs?: number;
  /** Per-request timeout of the JWKS fetch. */
  readonly timeoutMs?: number;
}

export interface JwksCache {
  /** The public key for `kid`, or `null` when the (fresh) set does not contain it. */
  getKey(kid: string): Promise<JWK | null>;
  /** Forces a refresh (used after configuration changes and by tests). */
  refresh(): Promise<void>;
}

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_MAX_STALE_MS = 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 5000;
const PRIVATE_MEMBERS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'k'];

function isPublicAsymmetricKey(value: unknown): value is JWK {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const key = value as Record<string, unknown>;
  return (
    (key.kty === 'EC' || key.kty === 'RSA') &&
    typeof key.kid === 'string' &&
    key.kid.length > 0 &&
    PRIVATE_MEMBERS.every((member) => !(member in key))
  );
}

/** Creates an isolated cache (tests use this with an injected fetch). */
export function createJwksCache(options: JwksCacheOptions): JwksCache {
  const fetchImpl = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const maxStaleMs = options.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let keys: Map<string, JWK> | null = null;
  let fetchedAt = 0;
  let inFlight: Promise<void> | null = null;

  async function load(): Promise<void> {
    const response = await fetchImpl(options.url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      throw new JwksUnavailableError(`JWKS request failed with HTTP ${response.status}.`);
    }
    const body: unknown = await response.json();
    const list = body !== null && typeof body === 'object' ? (body as { keys?: unknown }).keys : undefined;
    if (!Array.isArray(list)) {
      throw new JwksUnavailableError('JWKS response has no keys array.');
    }
    const next = new Map<string, JWK>();
    for (const candidate of list) {
      if (isPublicAsymmetricKey(candidate) && typeof candidate.kid === 'string') {
        next.set(candidate.kid, candidate);
      }
    }
    keys = next;
    fetchedAt = now();
  }

  function refresh(): Promise<void> {
    if (inFlight === null) {
      inFlight = load().finally(() => {
        inFlight = null;
      });
    }
    return inFlight;
  }

  async function getKey(kid: string): Promise<JWK | null> {
    const age = now() - fetchedAt;
    if (keys === null || keys.size === 0 || age >= ttlMs) {
      try {
        await refresh();
      } catch (error) {
        const stillUsable = keys !== null && keys.size > 0 && now() - fetchedAt < maxStaleMs;
        if (!stillUsable) {
          throw error instanceof JwksUnavailableError
            ? error
            : new JwksUnavailableError('JWKS could not be fetched.', { cause: error });
        }
      }
    }
    return keys?.get(kid) ?? null;
  }

  return { getKey, refresh };
}

const caches = new Map<string, JwksCache>();

/** The process-wide cache for the configured project (memoized per JWKS URL). */
export function getJwksCache(config: AppConfig = getConfig()): JwksCache {
  let cache = caches.get(config.supabase.jwksUrl);
  if (cache === undefined) {
    cache = createJwksCache({ url: config.supabase.jwksUrl });
    caches.set(config.supabase.jwksUrl, cache);
  }
  return cache;
}

/** Forgets every process-wide cache (tests only). */
export function resetJwksCaches(): void {
  caches.clear();
}
