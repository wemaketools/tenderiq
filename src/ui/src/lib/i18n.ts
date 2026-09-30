/**
 * `t(key, params)`: every UI string goes through this function (DD-37, docs/technical/09-frontend.md §7).
 *
 * Catalogs:
 * - The shell catalog `src/i18n/en.ts` owns the namespaces `shell`, `common`, `auth`, `ui`, `format`, `enum`,
 *   `charts`, `approvalWidget`, `documentWidget`, `audit` and `pages` (the shared widgets use
 *   `approvalWidget`/`documentWidget` so the workspace features may be named `approvals` and `documents`).
 * - Each feature keeps its strings in `src/features/<feature>/i18n/en.ts` (default export, or a named `en` export).
 *   Its keys are namespaced by the feature directory: key `list.title` in `features/tenders/i18n/en.ts` is
 *   `t('tenders.list.title')`. Catalogs may be nested objects or flat dotted keys; both are flattened.
 *
 * Interpolation: `{name}` placeholders are replaced from `params`. Plurals: when `params.count` is a number and the
 * catalog has `<key>_one` / `<key>_other` (English plural rules), the matching form is used.
 *
 * A missing key renders the key itself (so it is visible in review) and warns once in development builds. A test
 * checks that every literal key used by the shell exists.
 *
 * English only in this release; adding a language means adding `i18n/<lang>.ts` files and selecting them here.
 */
import { enumLabel } from '@contracts/enums';
import type { EnumName, EnumValue } from '@contracts/enums';

import { shellCatalog } from '../i18n/en';

/** A catalog: nested objects of strings. */
export interface Catalog {
  readonly [key: string]: string | Catalog;
}

export type TranslationParams = Readonly<Record<string, string | number>>;

/** Namespaces reserved for the shell catalog; a feature directory must not use one of these names. */
export const RESERVED_NAMESPACES = [
  'shell',
  'common',
  'auth',
  'ui',
  'format',
  'enum',
  'charts',
  'approvalWidget',
  'documentWidget',
  'audit',
  'pages',
] as const;

type CatalogModule = { readonly default?: Catalog; readonly en?: Catalog };

const messages = new Map<string, string>();
const warned = new Set<string>();

function flatten(prefix: string, catalog: Catalog, into: Map<string, string>): void {
  for (const [key, value] of Object.entries(catalog)) {
    const full = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      into.set(full, value);
    } else {
      flatten(full, value, into);
    }
  }
}

/** Adds (or replaces) the keys of a catalog under a namespace. Used at load time and by tests. */
export function registerCatalog(namespace: string, catalog: Catalog): void {
  flatten(namespace, catalog, messages);
}

/** The feature directory name of a catalog module path such as `../features/tenders/i18n/en.ts`. */
export function featureNamespaceOf(path: string): string | null {
  const match = /\/features\/([^/]+)\/i18n\/en\.ts$/.exec(path);
  return match?.[1] ?? null;
}

function loadCatalogs(): void {
  flatten('', shellCatalog, messages);
  const modules = import.meta.glob<CatalogModule>('../features/*/i18n/en.ts', { eager: true });
  for (const [path, module] of Object.entries(modules)) {
    const namespace = featureNamespaceOf(path);
    const catalog = module.default ?? module.en;
    if (namespace === null || catalog === undefined) {
      console.error(`i18n: ${path} must export its catalog as default or as "en".`);
      continue;
    }
    if ((RESERVED_NAMESPACES as readonly string[]).includes(namespace)) {
      console.error(`i18n: feature directory "${namespace}" uses a reserved catalog namespace.`);
      continue;
    }
    registerCatalog(namespace, catalog);
  }
}

loadCatalogs();

const pluralRules = new Intl.PluralRules('en');

function interpolate(template: string, params: TranslationParams | undefined): string {
  if (params === undefined) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    return value === undefined ? placeholder : String(value);
  });
}

/** True when the key exists (after plural resolution). */
export function hasTranslation(key: string): boolean {
  return messages.has(key) || messages.has(`${key}_other`);
}

/** Translates a key. See the module comment for interpolation and plural rules. */
export function t(key: string, params?: TranslationParams): string {
  const count = params?.count;
  if (typeof count === 'number') {
    const form = pluralRules.select(count);
    const plural = messages.get(`${key}_${form}`) ?? messages.get(`${key}_other`);
    if (plural !== undefined) {
      return interpolate(plural, params);
    }
  }
  const message = messages.get(key);
  if (message === undefined) {
    if (import.meta.env.DEV && !warned.has(key)) {
      warned.add(key);
      console.warn(`i18n: missing translation "${key}".`);
    }
    return key;
  }
  return interpolate(message, params);
}

/**
 * The label of an enumeration value: `enum.<table.column>.<value>` from a catalog when present, otherwise the
 * English label of `src/contracts/enums.ts` (which humanizes unknown values instead of dropping them).
 */
export function tEnum<N extends EnumName>(name: N, value: EnumValue<N> | (string & {})): string {
  const key = `enum.${name}.${value}`;
  return messages.has(key) ? t(key) : enumLabel(name, value);
}
