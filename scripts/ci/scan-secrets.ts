/**
 * Secret scan of the repository files (architecture brief §8.4; `npm run ci:security`).
 *
 * Scans every file git would commit (`git ls-files --cached --others --exclude-standard`, so new files are checked
 * before their first commit and git-ignored files such as `.env.local` and `supabase/signing_keys.json` are not)
 * and fails on:
 * - JWT-shaped strings (`eyJ….eyJ….…`): Supabase anon and service-role keys, access tokens;
 * - Supabase secret API keys (`sb_secret_…`) and publishable keys pasted as literals;
 * - PEM private keys and private JWK members next to an `"kty"`;
 * - connection URLs with an inline password (placeholders such as `<local-db-password>` are allowed).
 *
 * Findings print the file, line and rule, never the matched value.
 *
 * Usage: tsx scripts/ci/scan-secrets.ts
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

export interface SecretRule {
  readonly id: string;
  readonly description: string;
  readonly pattern: RegExp;
  /** Returns false for a match that is a documented placeholder. */
  readonly accept?: (match: string) => boolean;
}

const PLACEHOLDER_PASSWORD = /^(<[^>]+>|\$\{[^}]+\}|\*+|x+|password|\.\.\.)$/i;

export const SECRET_RULES: readonly SecretRule[] = [
  {
    id: 'jwt',
    description: 'JWT-shaped token or Supabase legacy API key',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  },
  { id: 'supabase-secret-key', description: 'Supabase secret API key', pattern: /sb_secret_[A-Za-z0-9_-]{10,}/g },
  { id: 'supabase-publishable-key', description: 'Supabase publishable key literal', pattern: /sb_publishable_[A-Za-z0-9_-]{10,}/g },
  { id: 'pem-private-key', description: 'PEM private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g },
  {
    id: 'private-jwk',
    description: 'Private JWK (a "d" member next to "kty")',
    pattern: /"kty"\s*:\s*"(?:EC|RSA|OKP)"[^{}]{0,400}"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/g,
  },
  {
    id: 'credentialed-url',
    description: 'Connection URL with an inline password',
    pattern: /\b(?:postgres(?:ql)?|mysql|redis|rediss|mongodb(?:\+srv)?|amqps?|smtps?):\/\/[^\s:/@'"`]+:([^\s@'"`]+)@/g,
    accept: (match) => {
      const password = /:\/\/[^\s:/@'"`]+:([^\s@'"`]+)@/.exec(match)?.[1] ?? '';
      return !PLACEHOLDER_PASSWORD.test(password);
    },
  },
];

export interface SecretFinding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly description: string;
}

/** Scans one text; returns findings without the matched values. */
export function scanText(file: string, text: string, rules: readonly SecretRule[] = SECRET_RULES): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      if (rule.accept !== undefined && !rule.accept(match[0])) {
        continue;
      }
      const line = text.slice(0, match.index).split('\n').length;
      findings.push({ file, line, rule: rule.id, description: rule.description });
    }
  }
  return findings;
}

const BINARY_EXTENSIONS = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|eot|pdf|zip|gz|xlsx|docx|pptx|mp4|webm)$/i;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Files git would commit (tracked + untracked, not ignored). */
export function candidateFiles(root: string = repoRoot): string[] {
  const output = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return output.split('\0').filter((file) => file !== '' && !BINARY_EXTENSIONS.test(file));
}

/** Scans the repository. */
export function scanRepository(root: string = repoRoot): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const file of candidateFiles(root)) {
    const absolute = join(root, file);
    let size: number;
    try {
      size = statSync(absolute).size;
    } catch {
      continue; // deleted in the working tree
    }
    if (size > MAX_FILE_BYTES) {
      continue;
    }
    const text = readFileSync(absolute, 'utf8');
    if (text.includes('\u0000')) {
      continue; // binary
    }
    findings.push(...scanText(file, text));
  }
  return findings;
}

function main(): void {
  const findings = scanRepository();
  if (findings.length > 0) {
    process.stderr.write(`scan-secrets: ${findings.length} finding(s):\n`);
    for (const finding of findings) {
      process.stderr.write(`  ${finding.file}:${finding.line}  ${finding.rule}  (${finding.description})\n`);
    }
    process.exitCode = 1;
    return;
  }
  process.stdout.write('scan-secrets: no secrets found in committable files.\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
