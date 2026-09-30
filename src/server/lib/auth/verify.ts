/**
 * Supabase access-token verification (architecture brief §5.7; docs/technical/07-api.md §3.2; DD-43).
 *
 * Cheapest and most suspicious checks first:
 *   1. decode the unsigned header (malformed → reject)
 *   2. algorithm allow-list: asymmetric only (`none` and HS* downgrades are rejected here)
 *   3. resolve `kid` against the cached JWKS (unknown → reject, no network round-trip)
 *   4. `supabase.auth.getClaims(token, { jwks: { keys: [key] } })`: local WebCrypto signature check + `exp`
 *   5. pin `iss` to the project's auth URL
 * and then the claims this API relies on: `sub` present and `role = authenticated` (an anon or service-role
 * token is never a user session).
 *
 * The result never throws for a bad token: it returns `{ ok: false, reason }`. The reason is for the SERVER LOG
 * only; the HTTP layer always answers the same 401 (brief §5.7). Infrastructure failures (JWKS unreachable) are
 * reported as `jwks_unavailable`, which the caller may log at a higher level.
 *
 * Used by the Stage A mock API (then mapping the verified email to a fixture persona) and, from Stage B, by the
 * real auth middleware (mapping `sub` to `users.auth_user_id`).
 */
import type { JWK, SupabaseClient } from '@supabase/supabase-js';

import { getConfig } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { JwksUnavailableError, getJwksCache } from '../supabase/jwks.js';
import { getVerificationClient } from '../supabase/clients.js';

/** Algorithms accepted in the token header: asymmetric only, and only those `getClaims` can verify locally. */
export const ALLOWED_JWT_ALGORITHMS = ['ES256', 'RS256'] as const;
export type AllowedJwtAlgorithm = (typeof ALLOWED_JWT_ALGORITHMS)[number];

/** Key type each allowed algorithm requires. */
const KEY_TYPE_OF: Record<AllowedJwtAlgorithm, string> = { ES256: 'EC', RS256: 'RSA' };

/** Tokens longer than this are rejected before any decoding work. */
export const MAX_TOKEN_LENGTH = 16 * 1024;

export type VerifyFailureReason =
  | 'missing_token'
  | 'malformed'
  | 'algorithm_not_allowed'
  | 'unknown_kid'
  | 'key_mismatch'
  | 'invalid_signature_or_expired'
  | 'issuer_mismatch'
  | 'invalid_claims'
  | 'jwks_unavailable';

/** The identity a verified token establishes. */
export interface VerifiedToken {
  /** `sub`: the Supabase Auth user id (Stage B maps it to `users.auth_user_id`). */
  readonly authUserId: string;
  /** `email`, lower-cased; `null` when the token carries none. */
  readonly email: string | null;
  readonly sessionId: string | null;
  /** `exp` in seconds since the epoch. */
  readonly expiresAt: number;
  readonly algorithm: AllowedJwtAlgorithm;
  readonly keyId: string;
}

export type VerifyResult =
  | { readonly ok: true; readonly token: VerifiedToken }
  | { readonly ok: false; readonly reason: VerifyFailureReason; readonly detail: string };

/** A claims verifier with the shape of `supabase.auth.getClaims`. */
export type ClaimsVerifier = (
  token: string,
  key: JWK,
) => Promise<{ ok: true; claims: Record<string, unknown> } | { ok: false; detail: string }>;

/** Everything verification depends on (injected by tests; `defaultVerifyDeps()` binds the real ones). */
export interface VerifyDeps {
  /** Resolves a key id against the cached JWKS (`null` = unknown kid). May throw `JwksUnavailableError`. */
  readonly getKey: (kid: string) => Promise<JWK | null>;
  readonly verifyClaims: ClaimsVerifier;
  /** The pinned issuer, `<SUPABASE_URL>/auth/v1`. */
  readonly issuer: string;
}

function fail(reason: VerifyFailureReason, detail: string): VerifyResult {
  return { ok: false, reason, detail };
}

function decodeSegment(segment: string): unknown {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) {
    throw new Error('not base64url');
  }
  const json = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlToBytes(segment));
  return JSON.parse(json) as unknown;
}

function base64UrlToBytes(segment: string): Uint8Array {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function isAllowedAlgorithm(value: unknown): value is AllowedJwtAlgorithm {
  return typeof value === 'string' && (ALLOWED_JWT_ALGORITHMS as readonly string[]).includes(value);
}

/** Extracts the token from an `Authorization: Bearer <token>` header value (`null` when absent or malformed). */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (header === null || header === undefined) {
    return null;
  }
  const match = /^Bearer[ ]+([^\s]+)[ ]*$/i.exec(header);
  return match?.[1] ?? null;
}

/** Builds a verifier over explicit dependencies. */
export function createTokenVerifier(deps: VerifyDeps): (token: string | null | undefined) => Promise<VerifyResult> {
  return async (token) => {
    if (token === null || token === undefined || token === '') {
      return fail('missing_token', 'No bearer token.');
    }
    if (token.length > MAX_TOKEN_LENGTH) {
      return fail('malformed', 'Token is too long.');
    }
    // 1. Decode the unsigned header.
    const parts = token.split('.');
    if (parts.length !== 3 || parts.some((part, index) => part === '' && index < 2)) {
      return fail('malformed', 'Token is not a three-part JWS.');
    }
    let header: Record<string, unknown>;
    try {
      const decoded = decodeSegment(parts[0] ?? '');
      if (decoded === null || typeof decoded !== 'object' || Array.isArray(decoded)) {
        return fail('malformed', 'Token header is not a JSON object.');
      }
      header = decoded as Record<string, unknown>;
    } catch {
      return fail('malformed', 'Token header cannot be decoded.');
    }
    // 2. Algorithm allow-list (asymmetric only).
    const algorithm = header.alg;
    if (!isAllowedAlgorithm(algorithm)) {
      return fail('algorithm_not_allowed', `Algorithm ${typeof algorithm === 'string' ? algorithm : '(none)'} is not allowed.`);
    }
    if ((parts[2] ?? '') === '') {
      return fail('malformed', 'Token has no signature.');
    }
    // 3. kid against the cached JWKS.
    const kid = header.kid;
    if (typeof kid !== 'string' || kid === '') {
      return fail('unknown_kid', 'Token header has no kid.');
    }
    let key: JWK | null;
    try {
      key = await deps.getKey(kid);
    } catch (error) {
      if (error instanceof JwksUnavailableError) {
        return fail('jwks_unavailable', error.message);
      }
      throw error;
    }
    if (key === null) {
      return fail('unknown_kid', 'Token kid is not in the signing key set.');
    }
    if (key.kty !== KEY_TYPE_OF[algorithm] || (key.alg !== undefined && key.alg !== algorithm)) {
      return fail('key_mismatch', 'Token algorithm does not match its signing key.');
    }
    // 4. Signature and expiry (local WebCrypto).
    const verified = await deps.verifyClaims(token, key);
    if (!verified.ok) {
      return fail('invalid_signature_or_expired', verified.detail);
    }
    const claims = verified.claims;
    // 5. Pin the issuer.
    if (claims.iss !== deps.issuer) {
      return fail('issuer_mismatch', 'Token issuer does not match the project.');
    }
    // Claims this API relies on.
    const sub = claims.sub;
    const exp = claims.exp;
    if (typeof sub !== 'string' || sub === '') {
      return fail('invalid_claims', 'Token has no subject.');
    }
    if (claims.role !== 'authenticated') {
      return fail('invalid_claims', 'Token is not an authenticated user session.');
    }
    if (typeof exp !== 'number' || !Number.isFinite(exp)) {
      return fail('invalid_claims', 'Token has no expiry.');
    }
    const email = typeof claims.email === 'string' && claims.email !== '' ? claims.email.toLowerCase() : null;
    const sessionId = typeof claims.session_id === 'string' ? claims.session_id : null;
    return { ok: true, token: { authUserId: sub, email, sessionId, expiresAt: exp, algorithm, keyId: kid } };
  };
}

/** A `ClaimsVerifier` over a supabase-js client's `auth.getClaims` with an explicit key set (no network). */
export function supabaseClaimsVerifier(client: SupabaseClient): ClaimsVerifier {
  return async (token, key) => {
    try {
      const { data, error } = await client.auth.getClaims(token, { jwks: { keys: [key] } });
      if (error !== null) {
        return { ok: false, detail: error.message };
      }
      if (data === null) {
        return { ok: false, detail: 'No claims returned.' };
      }
      return { ok: true, claims: data.claims as Record<string, unknown> };
    } catch (error) {
      return { ok: false, detail: error instanceof Error ? error.message : 'Claims verification failed.' };
    }
  };
}

/** The production dependencies for a configuration: cached JWKS + the memoized verification client. */
export function defaultVerifyDeps(config: AppConfig = getConfig()): VerifyDeps {
  const jwks = getJwksCache(config);
  return {
    getKey: (kid) => jwks.getKey(kid),
    verifyClaims: supabaseClaimsVerifier(getVerificationClient(config)),
    issuer: config.supabase.authIssuer,
  };
}

let defaultVerifier: ((token: string | null | undefined) => Promise<VerifyResult>) | null = null;

/** Verifies an access token with the process configuration (brief §5.7). */
export function verifyAccessToken(token: string | null | undefined): Promise<VerifyResult> {
  if (defaultVerifier === null) {
    defaultVerifier = createTokenVerifier(defaultVerifyDeps());
  }
  return defaultVerifier(token);
}

/** Forgets the default verifier (tests only). */
export function resetDefaultVerifier(): void {
  defaultVerifier = null;
}
