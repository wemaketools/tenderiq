import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { sha256Hex } from './sha256.js';

const nodeSha256 = (input: string | Uint8Array): string => createHash('sha256').update(input).digest('hex');

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it.each([
    ['a block-boundary string (55 bytes)', 'x'.repeat(55)],
    ['a block-boundary string (56 bytes)', 'x'.repeat(56)],
    ['a two-block string (64 bytes)', 'x'.repeat(64)],
    ['a long string', 'T2026-0014:rev-3|'.repeat(500)],
    ['non-ASCII text (hashed as UTF-8)', 'Kgalagadi — Ditshego “quoted” ½'],
  ])('matches node:crypto for %s', (_label, input) => {
    expect(sha256Hex(input)).toBe(nodeSha256(input));
  });

  it('matches node:crypto for raw bytes', () => {
    const bytes = Uint8Array.from({ length: 300 }, (_, index) => (index * 37) % 256);
    expect(sha256Hex(bytes)).toBe(nodeSha256(bytes));
  });
});
