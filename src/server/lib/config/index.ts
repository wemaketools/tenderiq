/**
 * Configuration loading (architecture brief §5.4). THE ONLY MODULE THAT READS `process.env` (lint-enforced).
 *
 * - `loadConfig(env)` is pure: it validates a plain record and returns a deep-frozen `AppConfig`, or throws a
 *   `ConfigurationError` that names EVERY bad variable. It never returns a partial configuration.
 * - `getConfig()` parses `process.env` once per process (cold start) and caches the success. A failed parse is
 *   not cached, so fixing the environment and retrying works without a restart.
 * - `tryGetConfig()` never throws; only the logger uses it, so it can report configuration failures.
 * - `resetConfigCache()` exists for tests that change the environment between cases.
 *
 * Error messages name variables and rules only; they never echo a value (values can be secrets).
 */
import { serverEnvSchema, toAppConfig } from './schema.js';
import type { AppConfig } from './schema.js';

export type { AppConfig, AppEnvValue, LogLevel } from './schema.js';
export { APP_ENV_VALUES, BROWSER_ENV_KEYS, LOG_LEVELS, SERVER_ENV_KEYS, blankAsAbsent } from './schema.js';

/** One invalid variable and why. */
export interface ConfigurationIssue {
  readonly variable: string;
  readonly message: string;
}

/** Thrown when the environment does not satisfy the schema. Lists every bad variable by name. */
export class ConfigurationError extends Error {
  readonly issues: readonly ConfigurationIssue[];

  constructor(issues: readonly ConfigurationIssue[]) {
    const variables = [...new Set(issues.map((issue) => issue.variable))];
    super(
      `Invalid server configuration: ${variables.join(', ')}. ` +
        issues.map((issue) => `${issue.variable}: ${issue.message}`).join(' '),
    );
    this.name = 'ConfigurationError';
    this.issues = issues;
  }

  /** The names of the invalid variables, without duplicates. */
  get variables(): string[] {
    return [...new Set(this.issues.map((issue) => issue.variable))];
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const member of Object.values(value as Record<string, unknown>)) {
      deepFreeze(member);
    }
    Object.freeze(value);
  }
  return value;
}

/** Validates an environment record and returns the frozen configuration (pure; used by tests and scripts). */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const result = serverEnvSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigurationError(
      result.error.issues.map((issue) => ({
        variable: issue.path.length > 0 ? String(issue.path[0]) : '(environment)',
        message: issue.message,
      })),
    );
  }
  return deepFreeze(toAppConfig(result.data));
}

let cached: AppConfig | null = null;

/** The process configuration, parsed from `process.env` once and cached on success. */
export function getConfig(): AppConfig {
  if (cached === null) {
    cached = loadConfig(process.env);
  }
  return cached;
}

/** Non-throwing variant of `getConfig()` (for the logger only, brief §5.4). */
export function tryGetConfig(): { ok: true; config: AppConfig } | { ok: false; error: ConfigurationError } {
  try {
    return { ok: true, config: getConfig() };
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return { ok: false, error };
    }
    throw error;
  }
}

/** Forgets the cached configuration (tests only). */
export function resetConfigCache(): void {
  cached = null;
}
