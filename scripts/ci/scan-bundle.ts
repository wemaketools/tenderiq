/**
 * Production bundle leak scan (architecture brief §8.4; architecture-plan §11 items 1 and 8; DD-43;
 * `npm run ci:security`).
 *
 * Builds the SPA (`npm run build:ui`; skip with `--no-build`) and fails if any file in `src/ui/dist` contains:
 * - mock API code or fixtures (persona e-mails `@tenderiq.local`, mock-api paths and messages);
 * - `src/server` code (paths and messages unique to the server platform modules);
 * - a server-only environment variable name (the keys of src/server/lib/config plus the Stage B catalog; the
 *   browser-safe `VITE_` names are allowed);
 * - the service-role key (the configured value, any `sb_secret_` key, or any JWT whose payload role is
 *   `service_role`);
 * - the marker string of the dev-only demo-accounts quick-pick, which renders only under `import.meta.env.DEV`
 *   (DD-43). The marker is read from `DEMO_ACCOUNTS_MARKER = '…'` in `src/ui/src/auth/**`; a missing declaration
 *   fails the scan, because the check could otherwise never fail.
 * It also checks that `index.html` carries the production Content-Security-Policy (DD-30) and that its script-src
 * has none of the dev-only relaxations (`'unsafe-inline'`, `'unsafe-eval'`, `ws:`).
 *
 * Findings print the file, the rule and a short context with secrets masked.
 *
 * Usage: tsx scripts/ci/scan-bundle.ts [--no-build] [--dist <dir>]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SERVER_ENV_KEYS, tryGetConfig } from '../../src/server/lib/config/index.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const DEFAULT_DIST = join(repoRoot, 'src', 'ui', 'dist');
export const UI_AUTH_DIR = join(repoRoot, 'src', 'ui', 'src', 'auth');

/** Server variables of later stages that must never reach the browser either (brief §8.1). */
export const STAGE_B_SERVER_KEYS = [
  'SUPABASE_DATABASE_URL',
  'SUPABASE_DIRECT_DATABASE_URL',
  'SUPABASE_JWT_SECRET',
  'CRON_SECRET',
  'INTERNAL_JOB_SECRET',
  'STORAGE_ADAPTER',
  'SMTP_PASSWORD',
  'SMTP_USER',
] as const;

export interface BundleRule {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
}

export interface BundleScanInputs {
  /** The configured service-role key, when available. */
  readonly serviceRoleKey: string | null;
  /** The demo-accounts marker string, when declared. */
  readonly demoAccountsMarker: string | null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The rules for one scan. */
export function bundleRules(inputs: BundleScanInputs): BundleRule[] {
  const serverKeys = [...new Set<string>([...SERVER_ENV_KEYS, ...STAGE_B_SERVER_KEYS])];
  const rules: BundleRule[] = [
    { id: 'mock-fixture', description: 'mock API fixture data (persona e-mail)', pattern: /@tenderiq\.local\b/g },
    { id: 'mock-code', description: 'mock API code', pattern: /mock-api[\\/]|handler module skipped|No fixture persona|fixture drift/g },
    {
      id: 'server-code',
      description: 'src/server code',
      pattern: /src[\\/]server[\\/]|Invalid server configuration|Token kid is not in the signing key set|JWKS response has no keys array/g,
    },
    {
      id: 'server-env-name',
      description: 'server-only environment variable name',
      pattern: new RegExp(`(?<![A-Za-z0-9_])(?<!VITE_)(?:${serverKeys.map(escapeRegExp).join('|')})(?![A-Za-z0-9_])`, 'g'),
    },
    { id: 'service-role-literal', description: 'Supabase secret key', pattern: /sb_secret_[A-Za-z0-9_-]{6,}|service_role_key/g },
  ];
  if (inputs.serviceRoleKey !== null && inputs.serviceRoleKey.length >= 16) {
    rules.push({ id: 'service-role-key', description: 'the configured service-role key', pattern: new RegExp(escapeRegExp(inputs.serviceRoleKey), 'g') });
  }
  if (inputs.demoAccountsMarker !== null) {
    rules.push({
      id: 'demo-accounts-marker',
      description: 'the dev-only demo-accounts quick-pick (DD-43)',
      pattern: new RegExp(escapeRegExp(inputs.demoAccountsMarker), 'g'),
    });
  }
  return rules;
}

export interface BundleFinding {
  readonly file: string;
  readonly rule: string;
  readonly description: string;
  readonly context: string;
}

const JWT = /eyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/g;

function jwtRole(payloadSegment: string): string | null {
  try {
    const json = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    const payload = JSON.parse(json) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function contextOf(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 30);
  const end = Math.min(text.length, index + length + 30);
  return text.slice(start, end).replace(/\s+/g, ' ').replace(JWT, '[JWT]').replace(/sb_secret_[A-Za-z0-9_-]+/g, 'sb_secret_[MASKED]');
}

/** Scans one bundle file's text. */
export function scanBundleText(file: string, text: string, rules: readonly BundleRule[]): BundleFinding[] {
  const findings: BundleFinding[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      const masked = rule.id === 'service-role-key' ? '[service-role key]' : contextOf(text, match.index, match[0].length);
      findings.push({ file, rule: rule.id, description: rule.description, context: masked });
    }
  }
  JWT.lastIndex = 0;
  for (const match of text.matchAll(JWT)) {
    if (jwtRole(match[1] ?? '') === 'service_role') {
      findings.push({ file, rule: 'service-role-jwt', description: 'a service_role JWT', context: '[JWT]' });
    }
  }
  return findings;
}

/** Every file under a directory. */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(path));
    } else if (entry.isFile()) {
      out.push(path);
    }
  }
  return out;
}

const MARKER_DECLARATION = /DEMO_ACCOUNTS_MARKER\s*(?::\s*[A-Za-z]+\s*)?=\s*(['"`])([^'"`]{8,})\1/;

/** Reads the demo-accounts marker declared in the SPA auth sources (`null` when none is declared). */
export function findDemoAccountsMarker(authDir: string = UI_AUTH_DIR): string | null {
  if (!existsSync(authDir)) {
    return null;
  }
  for (const file of listFiles(authDir)) {
    if (!/\.(ts|tsx)$/.test(file) || /\.test\.tsx?$/.test(file)) {
      continue;
    }
    const match = MARKER_DECLARATION.exec(readFileSync(file, 'utf8'));
    if (match?.[2] !== undefined) {
      return match[2];
    }
  }
  return null;
}

/** Scans a dist directory. */
export function scanBundle(dist: string, inputs: BundleScanInputs): BundleFinding[] {
  const rules = bundleRules(inputs);
  const findings: BundleFinding[] = [];
  for (const file of listFiles(dist)) {
    if (statSync(file).size > 20 * 1024 * 1024 || /\.(png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(file)) {
      continue;
    }
    findings.push(...scanBundleText(relative(dist, file), readFileSync(file, 'utf8'), rules));
  }
  return findings;
}

const CSP_META = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i;

/**
 * Checks the production Content-Security-Policy of the built index.html (DD-30): the meta tag is present and filled
 * in, and script-src allows neither inline scripts nor eval (the dev-only relaxations must not ship).
 */
export function checkProductionCsp(indexHtml: string): BundleFinding[] {
  const finding = (context: string): BundleFinding => ({
    file: 'index.html',
    rule: 'production-csp',
    description: 'the production Content-Security-Policy (DD-30)',
    context,
  });
  const match = CSP_META.exec(indexHtml);
  if (match?.[1] === undefined || match[1] === '') {
    return [finding('no Content-Security-Policy meta tag')];
  }
  const policy = match[1].replace(/&#39;|&apos;/g, "'");
  if (policy.includes('__TENDERIQ_CONTENT_SECURITY_POLICY__')) {
    return [finding('the policy token was not replaced')];
  }
  const scriptSrc = policy
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith('script-src '));
  if (scriptSrc === undefined) {
    return [finding('no script-src directive')];
  }
  const sources = scriptSrc.split(/\s+/);
  const relaxed = ["'unsafe-inline'", "'unsafe-eval'", 'ws:'].filter((source) => sources.includes(source));
  return relaxed.map((source) => finding(`script-src allows ${source}`));
}

function parseArgs(argv: readonly string[]): { build: boolean; dist: string } {
  let build = true;
  let dist = DEFAULT_DIST;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--no-build') {
      build = false;
    } else if (arg === '--dist') {
      const value = argv[index + 1];
      if (value === undefined) {
        throw new Error('--dist needs a directory.');
      }
      dist = resolve(value);
      index += 1;
    } else {
      throw new Error(`Unknown argument "${arg ?? ''}". Usage: scan-bundle.ts [--no-build] [--dist <dir>]`);
    }
  }
  return { build, dist };
}

function main(): void {
  const { build, dist } = parseArgs(process.argv.slice(2));
  if (build) {
    process.stdout.write('scan-bundle: building the SPA (npm run build:ui)...\n');
    // A fixed command string (no user input): on Windows npm is a .cmd shim and needs a shell;
    // passing one string avoids Node's DEP0190 warning about unescaped argument arrays.
    const result = spawnSync('npm run build:ui', { cwd: repoRoot, stdio: 'inherit', shell: true });
    if (result.status !== 0) {
      process.stderr.write('scan-bundle: the SPA build failed.\n');
      process.exitCode = 1;
      return;
    }
  }
  if (!existsSync(dist)) {
    process.stderr.write(`scan-bundle: ${dist} does not exist. Build the SPA first (npm run build:ui).\n`);
    process.exitCode = 1;
    return;
  }
  const demoAccountsMarker = findDemoAccountsMarker();
  if (demoAccountsMarker === null) {
    process.stderr.write(
      'scan-bundle: no DEMO_ACCOUNTS_MARKER declaration found in src/ui/src/auth. The dev-only demo-accounts quick-pick ' +
        'must declare its unique marker string (DD-43).\n',
    );
    process.exitCode = 1;
    return;
  }
  const configured = tryGetConfig();
  const indexHtml = join(dist, 'index.html');
  const findings = [
    ...scanBundle(dist, {
      serviceRoleKey: configured.ok ? configured.config.supabase.serviceRoleKey : null,
      demoAccountsMarker,
    }),
    ...checkProductionCsp(existsSync(indexHtml) ? readFileSync(indexHtml, 'utf8') : ''),
  ];
  if (findings.length > 0) {
    process.stderr.write(`scan-bundle: ${findings.length} finding(s) in ${dist}:\n`);
    for (const finding of findings) {
      process.stderr.write(`  ${finding.file}  ${finding.rule}  (${finding.description})  …${finding.context}…\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`scan-bundle: ${dist} is clean (no mock API, server code, server variables, secrets or demo accounts).\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`scan-bundle failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
