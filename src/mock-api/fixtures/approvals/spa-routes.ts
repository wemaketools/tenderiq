/**
 * The SPA route table as the fixture tests see it: every `src/ui/src/features/<feature>/routes.tsx` is read as text
 * and each `path:` of a feature module is joined to the root of the module's area (`/buyer`, `/supplier`, `/ops`,
 * `/me` or the site root). Paths given as `routes.key` constants are resolved from the feature's `lib` files.
 *
 * Test support only: the mock API never imports the SPA, so the fixture tests compare in-app links with this table
 * to prove that every link opens a real page.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AREA_ROOTS: Readonly<Record<string, string>> = {
  buyer: '/buyer',
  supplier: '/supplier',
  ops: '/ops',
  common: '/me',
  public: '',
};

const FEATURES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../ui/src/features');

function listSources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

/** Resolves `name.key` against `const name = { key: '...' }` objects declared in the feature's files. */
function constantResolver(featureDir: string): (expression: string) => string | null {
  const sources = listSources(featureDir).map((file) => readFileSync(file, 'utf8'));
  return (expression) => {
    const [name, key] = expression.split('.');
    if (name === undefined || key === undefined) return null;
    for (const source of sources) {
      const start = source.search(new RegExp(`const\\s+${name}\\b[^=]*=\\s*\\{`));
      if (start < 0) continue;
      const block = source.slice(start, source.indexOf('}', start));
      const match = new RegExp(`\\b${key}\\s*:\\s*'([^']*)'`).exec(block);
      if (match?.[1] !== undefined) return match[1];
    }
    return null;
  };
}

/** Every route of the SPA as an absolute pattern such as `/buyer/tenders/:tenderId`. */
export function spaRoutePatterns(): string[] {
  const patterns = new Set<string>();
  for (const feature of readdirSync(FEATURES_DIR)) {
    const file = join(FEATURES_DIR, feature, 'routes.tsx');
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    const resolveConstant = constantResolver(join(FEATURES_DIR, feature));
    const areas = [...source.matchAll(/\barea:\s*'(\w+)'/g)];
    areas.forEach((area, index) => {
      const root = AREA_ROOTS[area[1] ?? ''];
      if (root === undefined) return;
      const end = areas[index + 1]?.index ?? source.length;
      const block = source.slice(area.index, end);
      for (const match of block.matchAll(/\bpath:\s*(?:'([^']*)'|([A-Za-z_$][\w$]*\.[\w$]+))/g)) {
        const path = match[1] ?? resolveConstant(match[2] ?? '');
        if (path === null) continue;
        patterns.add(path === '' ? root || '/' : `${root}/${path}`);
      }
    });
  }
  return [...patterns].sort();
}

/** True when an in-app link (query string and hash ignored) opens one of the route patterns. */
export function matchesRoute(link: string, patterns: readonly string[]): boolean {
  const path = link.split(/[?#]/)[0] ?? link;
  const segments = path.split('/').filter((segment) => segment !== '');
  return patterns.some((pattern) => {
    const parts = pattern.split('/').filter((segment) => segment !== '');
    if (parts[parts.length - 1] === '*') {
      return parts.slice(0, -1).every((part, i) => part.startsWith(':') ? segments[i] !== undefined : part === segments[i]);
    }
    return (
      parts.length === segments.length &&
      parts.every((part, i) => (part.startsWith(':') ? /^[^/]+$/.test(segments[i] ?? '') : part === segments[i]))
    );
  });
}
