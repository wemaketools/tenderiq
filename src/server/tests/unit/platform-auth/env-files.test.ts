/**
 * Guards of brief §5.4 and §8.2:
 * - `.env.example` and `.env.local.example` list exactly the variables the config schema reads, plus the
 *   browser-safe `VITE_` keys; they hold placeholders only (no JWT, no inline connection-string password).
 * - `.env.example` is alphabetical `KEY="value"` (a Doppler export).
 * - Only src/server/lib/config/index.ts reads `process.env` (source scan backing the ESLint rule).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { BROWSER_ENV_KEYS, SERVER_ENV_KEYS } from '../../../lib/config/index.js';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));

function entries(file: string): Array<{ key: string; value: string; raw: string }> {
  return readFileSync(join(repoRoot, file), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.trimStart().startsWith('#'))
    .map((raw) => {
      const index = raw.indexOf('=');
      return { key: raw.slice(0, index).trim(), value: raw.slice(index + 1).trim(), raw };
    });
}

const EXPECTED_KEYS = [...SERVER_ENV_KEYS, ...BROWSER_ENV_KEYS].sort();

describe.each(['.env.example', '.env.local.example'])('%s', (file) => {
  it('lists exactly the schema variables plus the browser-safe VITE_ keys', () => {
    expect(entries(file).map((entry) => entry.key).sort()).toEqual(EXPECTED_KEYS);
  });

  it('contains no JWT-shaped value, Supabase secret or inline connection-string password', () => {
    const text = readFileSync(join(repoRoot, file), 'utf8');
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}\.eyJ/);
    expect(text).not.toMatch(/sb_(secret|publishable)_[A-Za-z0-9]/);
    expect(text).not.toMatch(/:\/\/[^\s:/@]+:(?!<)[^\s@]+@/);
  });
});

describe('.env.example', () => {
  it('is alphabetical KEY="value"', () => {
    const list = entries('.env.example');
    expect(list.map((entry) => entry.key)).toEqual([...list.map((entry) => entry.key)].sort());
    for (const entry of list) {
      expect(entry.raw).toMatch(/^[A-Z][A-Z0-9_]*="[^"]*"$/);
    }
  });
});

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') {
      continue;
    }
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (/\.(ts|mts|js|mjs)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out;
}

describe('process.env access', () => {
  it('happens only in src/server/lib/config/index.ts across src/server, src/mock-api and src/contracts', () => {
    // Arrange
    const roots = ['src/server', 'src/mock-api', 'src/contracts'].map((dir) => join(repoRoot, dir));

    // Act
    const offenders = roots
      .flatMap(sourceFiles)
      .filter((file) => /process\s*\.\s*env|process\s*\[\s*['"]env['"]\s*\]|from\s+['"](node:)?process['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(repoRoot, file).replace(/\\/g, '/'));

    // Assert
    expect(offenders).toEqual(['src/server/lib/config/index.ts']);
  });
});
