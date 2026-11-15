/**
 * Prototype authentication (DD-50, architecture-plan §3.11).
 *
 * Stage A has no auth provider. The SPA's persona picker keeps the chosen demo persona's e-mail as its session and
 * sends it as the bearer token; this verifier accepts any well-formed e-mail and the chain then maps it to its
 * fixture persona (an unknown or inactive persona gets the same 401 as a bad token). No password or credential is
 * involved, and nothing here is reused by Stage B, which verifies real Supabase JWTs (brief §5.7).
 */

/** Why a token was rejected; for the request log only (the HTTP answer is always the same 401). */
export type TokenFailureReason = 'missing_token' | 'malformed';

export type TokenVerifyResult =
  | { readonly ok: true; readonly email: string }
  | { readonly ok: false; readonly reason: TokenFailureReason; readonly detail: string };

/** Resolves a bearer token to the e-mail of the persona it names. */
export type TokenVerifier = (token: string | null) => Promise<TokenVerifyResult>;

/** Tokens longer than this are rejected before any parsing. */
const MAX_TOKEN_LENGTH = 320;
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The token of `Authorization: Bearer <token>`, or `null` when the header is absent or malformed. */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (header === null || header === undefined) {
    return null;
  }
  const match = /^Bearer[ ]+([^\s]+)[ ]*$/i.exec(header);
  return match?.[1] ?? null;
}

/** The bearer token the SPA sends for a persona: its demo e-mail. */
export function personaToken(email: string): string {
  return email.trim().toLowerCase();
}

/** The prototype verifier: the token must be a persona e-mail. */
export const personaTokenVerifier: TokenVerifier = (token) => {
  if (token === null || token === '') {
    return Promise.resolve({ ok: false, reason: 'missing_token', detail: 'No bearer token.' });
  }
  if (token.length > MAX_TOKEN_LENGTH || !EMAIL_SHAPE.test(token)) {
    return Promise.resolve({ ok: false, reason: 'malformed', detail: 'The token is not a persona e-mail.' });
  }
  return Promise.resolve({ ok: true, email: personaToken(token) });
};
