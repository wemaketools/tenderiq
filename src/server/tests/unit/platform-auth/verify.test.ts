/**
 * Unit tests of src/server/lib/auth/verify.ts with locally generated keys (no network): every check of brief §5.7
 * in order, including forged, expired, `alg: none` and HS256 downgrade tokens.
 */
import { createClient } from '@supabase/supabase-js';
import type { JWK } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  createTokenVerifier,
  extractBearerToken,
  supabaseClaimsVerifier,
} from '../../../lib/auth/verify.js';
import type { VerifyDeps } from '../../../lib/auth/verify.js';
import {
  base64url,
  generateEs256KeyPair,
  sessionClaims,
  signEs256,
  signHs256,
  tamperPayload,
  unsignedToken,
} from './jwt-helpers.js';
import type { TestKeyPair } from './jwt-helpers.js';

const ISSUER = 'http://auth.test/auth/v1';
// The verification client is only used with an explicit key set, so it never calls this URL.
const client = createClient('http://auth.test', 'test-anon-key', {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

let trusted: TestKeyPair;
let attacker: TestKeyPair;

beforeAll(async () => {
  trusted = await generateEs256KeyPair('trusted-kid');
  attacker = await generateEs256KeyPair('attacker-kid');
});

function depsWith(keys: Record<string, JWK>): VerifyDeps & { getKey: ReturnType<typeof vi.fn> } {
  const getKey = vi.fn(async (kid: string) => keys[kid] ?? null);
  return { getKey, verifyClaims: supabaseClaimsVerifier(client), issuer: ISSUER };
}

describe('createTokenVerifier', () => {
  it('accepts a valid ES256 session token and returns the subject and lower-cased email', async () => {
    // Arrange
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const token = await signEs256(
      { alg: 'ES256', typ: 'JWT', kid: trusted.kid },
      sessionClaims(ISSUER, { email: 'Tebogo.Officer@TenderIQ.local' }),
      trusted.privateJwk,
    );

    // Act
    const result = await verify(token);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.email).toBe('tebogo.officer@tenderiq.local');
      expect(result.token.authUserId).toBe('6f1c2a54-2f36-4d4f-9a55-0c7d2b8e1a10');
      expect(result.token.algorithm).toBe('ES256');
    }
  });

  it('rejects a missing token as missing_token', async () => {
    const verify = createTokenVerifier(depsWith({}));
    await expect(verify(null)).resolves.toMatchObject({ ok: false, reason: 'missing_token' });
    await expect(verify('')).resolves.toMatchObject({ ok: false, reason: 'missing_token' });
  });

  it.each([
    ['one segment', 'abc'],
    ['two segments', 'abc.def'],
    ['a header that is not base64url JSON', '%%%.eyJzdWIiOiJ4In0.sig'],
    ['a header that is a JSON array', `${base64url('[1]')}.${base64url('{}')}.c2ln`],
  ])('rejects a malformed token (%s) before any key lookup', async (_label, token) => {
    // Arrange
    const deps = depsWith({ [trusted.kid]: trusted.publicJwk });
    const verify = createTokenVerifier(deps);

    // Act
    const result = await verify(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'malformed' });
    expect(deps.getKey).not.toHaveBeenCalled();
  });

  it('rejects an alg none token at the algorithm allow-list without a key lookup', async () => {
    // Arrange
    const deps = depsWith({ [trusted.kid]: trusted.publicJwk });
    const verify = createTokenVerifier(deps);

    // Act
    const result = await verify(unsignedToken(sessionClaims(ISSUER), trusted.kid));

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'algorithm_not_allowed' });
    expect(deps.getKey).not.toHaveBeenCalled();
  });

  it('rejects an HS256 downgrade token at the algorithm allow-list', async () => {
    // Arrange
    const deps = depsWith({ [trusted.kid]: trusted.publicJwk });
    const verify = createTokenVerifier(deps);
    const token = await signHs256({ alg: 'HS256', typ: 'JWT', kid: trusted.kid }, sessionClaims(ISSUER), 'guessed-secret');

    // Act
    const result = await verify(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'algorithm_not_allowed' });
    expect(deps.getKey).not.toHaveBeenCalled();
  });

  it('rejects a token whose kid is not in the key set', async () => {
    // Arrange
    const deps = depsWith({ [trusted.kid]: trusted.publicJwk });
    const verify = createTokenVerifier(deps);
    const token = await signEs256({ alg: 'ES256', typ: 'JWT', kid: attacker.kid }, sessionClaims(ISSUER), attacker.privateJwk);

    // Act
    const result = await verify(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'unknown_kid' });
    expect(deps.getKey).toHaveBeenCalledWith(attacker.kid);
  });

  it('rejects a token without a kid', async () => {
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const token = await signEs256({ alg: 'ES256', typ: 'JWT' }, sessionClaims(ISSUER), trusted.privateJwk);
    await expect(verify(token)).resolves.toMatchObject({ ok: false, reason: 'unknown_kid' });
  });

  it('rejects a forged token signed by another key under the trusted kid', async () => {
    // Arrange
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const forged = await signEs256({ alg: 'ES256', typ: 'JWT', kid: trusted.kid }, sessionClaims(ISSUER), attacker.privateJwk);

    // Act
    const result = await verify(forged);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'invalid_signature_or_expired' });
  });

  it('rejects a validly signed token whose payload was tampered with', async () => {
    // Arrange
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const token = await signEs256({ alg: 'ES256', typ: 'JWT', kid: trusted.kid }, sessionClaims(ISSUER), trusted.privateJwk);

    // Act
    const result = await verify(tamperPayload(token, { email: 'admin.kwu@tenderiq.local' }));

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'invalid_signature_or_expired' });
  });

  it('rejects an expired token even when its signature is valid', async () => {
    // Arrange
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const now = Math.floor(Date.now() / 1000);
    const token = await signEs256(
      { alg: 'ES256', typ: 'JWT', kid: trusted.kid },
      sessionClaims(ISSUER, { iat: now - 7200, exp: now - 60 }),
      trusted.privateJwk,
    );

    // Act
    const result = await verify(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'invalid_signature_or_expired' });
  });

  it('rejects a validly signed token from another issuer', async () => {
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const token = await signEs256(
      { alg: 'ES256', typ: 'JWT', kid: trusted.kid },
      sessionClaims('http://evil.test/auth/v1'),
      trusted.privateJwk,
    );
    await expect(verify(token)).resolves.toMatchObject({ ok: false, reason: 'issuer_mismatch' });
  });

  it.each([
    ['role anon (the anon key)', { role: 'anon' }],
    ['role service_role', { role: 'service_role' }],
    ['an empty subject', { sub: '' }],
  ])('rejects a validly signed token with %s', async (_label, overrides) => {
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const token = await signEs256({ alg: 'ES256', typ: 'JWT', kid: trusted.kid }, sessionClaims(ISSUER, overrides), trusted.privateJwk);
    await expect(verify(token)).resolves.toMatchObject({ ok: false, reason: 'invalid_claims' });
  });

  it('rejects a token whose algorithm does not match the key type', async () => {
    // Arrange: an RS256 header pointing at the EC key.
    const verify = createTokenVerifier(depsWith({ [trusted.kid]: trusted.publicJwk }));
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: trusted.kid }));
    const token = `${header}.${base64url(JSON.stringify(sessionClaims(ISSUER)))}.${base64url('signature')}`;

    // Act
    const result = await verify(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'key_mismatch' });
  });

  it('reports jwks_unavailable when the key set cannot be loaded', async () => {
    // Arrange
    const { JwksUnavailableError } = await import('../../../lib/supabase/jwks.js');
    const verify = createTokenVerifier({
      getKey: async () => {
        throw new JwksUnavailableError('down');
      },
      verifyClaims: supabaseClaimsVerifier(client),
      issuer: ISSUER,
    });
    const token = await signEs256({ alg: 'ES256', typ: 'JWT', kid: trusted.kid }, sessionClaims(ISSUER), trusted.privateJwk);

    // Act
    const result = await verify(token);

    // Assert
    expect(result).toMatchObject({ ok: false, reason: 'jwks_unavailable' });
  });
});

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
    ['bearer abc.def.ghi', 'abc.def.ghi'],
    ['Basic abc', null],
    ['Bearer', null],
    ['Bearer a b', null],
    [undefined, null],
  ])('extracts the token from %s', (header, expected) => {
    expect(extractBearerToken(header)).toBe(expected);
  });
});
