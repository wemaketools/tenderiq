/** Unit tests of the JWKS cache (src/server/lib/supabase/jwks.ts), with an injected fetch and clock. */
import { describe, expect, it, vi } from 'vitest';

import { JwksUnavailableError, createJwksCache } from '../../../lib/supabase/jwks.js';

const EC_KEY = { kty: 'EC', kid: 'k1', crv: 'P-256', x: 'x', y: 'y', alg: 'ES256', key_ops: ['verify'] };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function setup(responses: Array<Response | Error>) {
  let clock = 1_000_000;
  const fetchMock = vi.fn(async () => {
    const next = responses.shift();
    if (next === undefined) {
      throw new Error('no more responses');
    }
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
  const cache = createJwksCache({
    url: 'http://auth.test/auth/v1/.well-known/jwks.json',
    fetch: fetchMock as unknown as typeof fetch,
    now: () => clock,
    ttlMs: 1000,
    maxStaleMs: 5000,
  });
  return { cache, fetchMock, advance: (ms: number) => (clock += ms) };
}

describe('createJwksCache', () => {
  it('fetches once and serves a known kid from the cache afterwards', async () => {
    // Arrange
    const { cache, fetchMock } = setup([jsonResponse({ keys: [EC_KEY] })]);

    // Act
    const first = await cache.getKey('k1');
    const second = await cache.getKey('k1');

    // Assert
    expect(first).toMatchObject({ kid: 'k1' });
    expect(second).toMatchObject({ kid: 'k1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown kid from a fresh cache without another network round-trip', async () => {
    // Arrange
    const { cache, fetchMock } = setup([jsonResponse({ keys: [EC_KEY] })]);
    await cache.getKey('k1');

    // Act
    const unknown = await cache.getKey('forged-kid');

    // Assert
    expect(unknown).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches after the TTL, so a rotated key becomes known', async () => {
    // Arrange
    const rotated = { ...EC_KEY, kid: 'k2' };
    const { cache, fetchMock, advance } = setup([jsonResponse({ keys: [EC_KEY] }), jsonResponse({ keys: [rotated] })]);
    await cache.getKey('k1');
    advance(1500);

    // Act
    const key = await cache.getKey('k2');

    // Assert
    expect(key).toMatchObject({ kid: 'k2' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps serving the previous set when a refresh fails within the stale window', async () => {
    // Arrange
    const { cache, advance } = setup([jsonResponse({ keys: [EC_KEY] }), new Error('network down')]);
    await cache.getKey('k1');
    advance(1500);

    // Act
    const key = await cache.getKey('k1');

    // Assert
    expect(key).toMatchObject({ kid: 'k1' });
  });

  it('throws JwksUnavailableError when nothing usable is cached', async () => {
    const { cache } = setup([jsonResponse({ error: 'x' }, 503)]);
    await expect(cache.getKey('k1')).rejects.toBeInstanceOf(JwksUnavailableError);
  });

  it('drops private and symmetric keys from the set', async () => {
    // Arrange
    const { cache } = setup([
      jsonResponse({
        keys: [
          { ...EC_KEY, kid: 'private', d: 'secret-part' },
          { kty: 'oct', kid: 'symmetric', k: 'c2VjcmV0' },
          EC_KEY,
        ],
      }),
    ]);

    // Act
    const privateKey = await cache.getKey('private');
    const symmetric = await cache.getKey('symmetric');
    const publicKey = await cache.getKey('k1');

    // Assert
    expect(privateKey).toBeNull();
    expect(symmetric).toBeNull();
    expect(publicKey).toMatchObject({ kid: 'k1' });
  });

  it('shares one request between concurrent lookups', async () => {
    const { cache, fetchMock } = setup([jsonResponse({ keys: [EC_KEY] })]);
    await Promise.all([cache.getKey('k1'), cache.getKey('k1'), cache.getKey('k1')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
