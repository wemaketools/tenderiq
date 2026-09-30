/**
 * JWT helpers for the platform-auth tests: key pairs, compact JWS signing, forged variants, and the LOCAL signing key
 * of the Supabase Docker stack (`supabase/signing_keys.json`, git-ignored, local only) for tokens that are validly
 * signed but must still be rejected (expired, wrong issuer, unknown account).
 */
import type { webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { JWK } from '@supabase/supabase-js';

export type JsonObject = Record<string, unknown>;
type JsonWebKey = webcrypto.JsonWebKey;

export interface TestKeyPair {
  readonly kid: string;
  readonly privateJwk: JsonWebKey & { kid: string };
  readonly publicJwk: JWK;
}

/** base64url of a string or bytes. */
export function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  return Buffer.from(bytes).toString('base64url');
}

/** Generates an ES256 key pair with `kid`. */
export async function generateEs256KeyPair(kid: string): Promise<TestKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateJwk = (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey;
  const publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
  return {
    kid,
    privateJwk: { ...privateJwk, kid },
    publicJwk: { ...publicJwk, kid, alg: 'ES256', use: 'sig', key_ops: ['verify'] } as JWK,
  };
}

/** Signs `header.payload` with an ES256 private JWK (JWS P1363 signature). */
export async function signEs256(header: JsonObject, payload: JsonObject, privateJwk: JsonWebKey): Promise<string> {
  const { key_ops: _ops, ...jwk } = privateJwk as JsonWebKey & { key_ops?: string[] };
  const key = await crypto.subtle.importKey('jwk', { ...jwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput)),
  );
  return `${signingInput}.${base64url(signature)}`;
}

/** An HS256 token signed with `secret` (a downgrade attempt). */
export async function signHs256(header: JsonObject, payload: JsonObject, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput)));
  return `${signingInput}.${base64url(signature)}`;
}

/** An unsigned `alg: none` token. */
export function unsignedToken(payload: JsonObject, kid?: string): string {
  const header = kid === undefined ? { alg: 'none', typ: 'JWT' } : { alg: 'none', typ: 'JWT', kid };
  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.`;
}

/** Decodes a compact JWT's header and payload (no verification). */
export function decodeJwt(token: string): { header: JsonObject; payload: JsonObject } {
  const [header = '', payload = ''] = token.split('.');
  return {
    header: JSON.parse(Buffer.from(header, 'base64url').toString('utf8')) as JsonObject,
    payload: JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JsonObject,
  };
}

/** Replaces the payload of a signed token, keeping header and signature (a tampered token). */
export function tamperPayload(token: string, patch: JsonObject): string {
  const [header = '', , signature = ''] = token.split('.');
  const { payload } = decodeJwt(token);
  return `${header}.${base64url(JSON.stringify({ ...payload, ...patch }))}.${signature}`;
}

/** Standard claims of a user session token. */
export function sessionClaims(issuer: string, overrides: JsonObject = {}): JsonObject {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: issuer,
    sub: '6f1c2a54-2f36-4d4f-9a55-0c7d2b8e1a10',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'tebogo.officer@tenderiq.local',
    session_id: '0b5a9d1e-3f0c-4f7e-8a8c-2d1f6c9b7e21',
    iat: now - 10,
    exp: now + 3600,
    ...overrides,
  };
}

/** The ES256 private JWK of the LOCAL Supabase stack (supabase/signing_keys.json). */
export function localStackSigningKey(): JsonWebKey & { kid: string } {
  const path = fileURLToPath(new URL('../../../../../supabase/signing_keys.json', import.meta.url));
  const keys = JSON.parse(readFileSync(path, 'utf8')) as Array<JsonWebKey & { kid: string }>;
  const key = keys[0];
  if (key === undefined) {
    throw new Error('supabase/signing_keys.json has no key; run npm run supabase:start.');
  }
  return key;
}
