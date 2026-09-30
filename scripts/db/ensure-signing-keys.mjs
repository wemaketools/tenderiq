/**
 * Ensures supabase/signing_keys.json exists: a LOCAL-ONLY ES256 JWK set for the Supabase CLI stack.
 *
 * Why (architecture brief §5.7): supabase/config.toml sets `[auth] signing_keys_path`, so local Supabase Auth
 * signs JWTs with an asymmetric ES256 key and publishes the public half at /auth/v1/.well-known/jwks.json.
 * The API (and the Stage A mock API, DD-43) verifies tokens against that JWKS; SUPABASE_JWT_SECRET is never used.
 * The CLI refuses to start without the file, and the file must never be committed (it is git-ignored).
 *
 * Behaviour:
 * - A valid file is left untouched, so issued sessions stay valid across restarts.
 * - A missing file is generated with node:crypto (P-256 key pair, random kid), in the format the CLI's
 *   `supabase gen signing-key --algorithm ES256` produces, wrapped in a JSON array (a key set).
 * - An unreadable or invalid file (for example a half-written file after a power loss) is replaced, with a
 *   warning. Restart the stack afterwards if it was running (`npm run supabase:stop`, then `npm run supabase:start`).
 * - Writes are atomic (temporary file + rename). Key material is never printed.
 *
 * Usage: node scripts/db/ensure-signing-keys.mjs   (run by `npm run supabase:start` before `supabase start`)
 */
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const keysPath = fileURLToPath(new URL('../../supabase/signing_keys.json', import.meta.url));
const displayPath = 'supabase/signing_keys.json';

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/**
 * @param {unknown} key
 * @returns {boolean}
 */
function isEs256PrivateJwk(key) {
  if (typeof key !== 'object' || key === null) return false;
  const jwk = /** @type {Record<string, unknown>} */ (key);
  return (
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    jwk.alg === 'ES256' &&
    typeof jwk.kid === 'string' &&
    jwk.kid.length > 0 &&
    ['d', 'x', 'y'].every((part) => typeof jwk[part] === 'string' && BASE64URL.test(/** @type {string} */ (jwk[part])))
  );
}

/**
 * @returns {{ valid: true } | { valid: false, reason: string }}
 */
function inspectExistingFile() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(keysPath, 'utf8'));
  } catch (error) {
    return { valid: false, reason: `it is not readable JSON (${error instanceof Error ? error.message : String(error)})` };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { valid: false, reason: 'it is not a non-empty JSON array of JWKs' };
  }
  if (!parsed.every(isEs256PrivateJwk)) {
    return { valid: false, reason: 'it contains a key that is not an ES256 (P-256) private JWK with a kid' };
  }
  return { valid: true };
}

function generateKeySet() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = privateKey.export({ format: 'jwk' });
  return [
    {
      kty: 'EC',
      kid: randomUUID(),
      use: 'sig',
      key_ops: ['sign', 'verify'],
      alg: 'ES256',
      ext: true,
      d: jwk.d,
      crv: 'P-256',
      x: jwk.x,
      y: jwk.y,
    },
  ];
}

function writeAtomically(content) {
  const temporaryPath = `${keysPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, content, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporaryPath, keysPath);
}

function main() {
  if (existsSync(keysPath)) {
    const inspection = inspectExistingFile();
    if (inspection.valid) {
      process.stdout.write(`${displayPath}: present (ES256), left unchanged.\n`);
      return;
    }
    console.warn(
      `${displayPath} is invalid: ${inspection.reason}. Generating a new local ES256 key. ` +
        'If the Supabase stack is running, restart it (npm run supabase:stop, then npm run supabase:start); ' +
        'existing local sessions become invalid and users must sign in again.',
    );
  }
  const keySet = generateKeySet();
  if (!keySet.every(isEs256PrivateJwk)) {
    throw new Error('Generated key does not have the expected ES256 JWK shape.');
  }
  writeAtomically(`${JSON.stringify(keySet, null, 2)}\n`);
  process.stdout.write(`${displayPath}: generated a new local ES256 signing key (kid ${keySet[0].kid}).\n`);
}

try {
  main();
} catch (error) {
  console.error(`ensure-signing-keys failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
