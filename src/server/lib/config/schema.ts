/**
 * The typed server environment (architecture brief §5.4, §8.1).
 *
 * Kept for Stage B: the Stage A static prototype reads none of these (DD-50). This is the subset written in Stage A
 * under DD-43, when the mock API verified real Supabase JWTs; Stage B extends it:
 *
 * | Variable                    | Required | Purpose                                                            |
 * |-----------------------------|----------|--------------------------------------------------------------------|
 * | `APP_ENV`                   | no       | `local` (default) / `dev` / `preview` / `staging` / `production`   |
 * | `LOG_LEVEL`                 | no       | `debug` / `info` (default) / `warn` / `error`                      |
 * | `SUPABASE_URL`              | yes      | Project URL; the JWT issuer is pinned to `<url>/auth/v1`            |
 * | `SUPABASE_ANON_KEY`         | yes      | Verification client (`getClaims` only)                              |
 * | `SUPABASE_SERVICE_ROLE_KEY` | yes      | Admin client: Auth Admin API (and Storage in Stage B). Server only. |
 *
 * Stage B (B1 `platform-http`) extends THIS schema with every other server variable of brief §8.1. Adding a
 * variable changes four things together: this file, `.env.example`, `.env.local.example` and
 * `docs/environment-variables.md`; a unit test checks that both example files list exactly `SERVER_ENV_KEYS`
 * plus the browser-safe `VITE_` keys.
 *
 * Blank values count as unset (`blankAsAbsent`), so a blank entry in a secret store behaves like a missing one:
 * an optional variable falls back to its default and a required one is reported by name.
 */
import { z } from 'zod';

/** `APP_ENV` values. The only behavioral branch is `!== 'local'` (brief §5.4). */
export const APP_ENV_VALUES = ['local', 'dev', 'preview', 'staging', 'production'] as const;
export type AppEnvValue = (typeof APP_ENV_VALUES)[number];

/** `LOG_LEVEL` values, in increasing severity. */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Treats `undefined`, `''` and whitespace-only strings as absent before `schema` runs. */
export function blankAsAbsent<T extends z.ZodType>(schema: T) {
  return z.preprocess((value: unknown) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined;
    }
    return typeof value === 'string' ? value.trim() : value;
  }, schema);
}

function required(name: string) {
  return z.string({ error: `${name} is required.` }).min(1, `${name} is required.`);
}

const httpUrl = (name: string) =>
  required(name).refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && url.username === '' && url.password === '';
    } catch {
      return false;
    }
  }, `${name} must be an absolute http(s) URL without credentials.`);

/** The raw environment variables, validated. Keys are the variable names. */
export const serverEnvSchema = z
  .object({
    APP_ENV: blankAsAbsent(z.enum(APP_ENV_VALUES, { error: `APP_ENV must be one of ${APP_ENV_VALUES.join(', ')}.` }).default('local')),
    LOG_LEVEL: blankAsAbsent(z.enum(LOG_LEVELS, { error: `LOG_LEVEL must be one of ${LOG_LEVELS.join(', ')}.` }).default('info')),
    SUPABASE_URL: blankAsAbsent(httpUrl('SUPABASE_URL')),
    SUPABASE_ANON_KEY: blankAsAbsent(required('SUPABASE_ANON_KEY')),
    SUPABASE_SERVICE_ROLE_KEY: blankAsAbsent(required('SUPABASE_SERVICE_ROLE_KEY')),
  })
  .superRefine((env, ctx) => {
    // Guards: zod may run this refinement even when a member already failed.
    if (typeof env.SUPABASE_URL !== 'string' || typeof env.SUPABASE_ANON_KEY !== 'string') {
      return;
    }
    if (env.APP_ENV !== 'local' && env.SUPABASE_URL.startsWith('http:')) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_URL'],
        message: 'SUPABASE_URL must use https outside APP_ENV=local.',
      });
    }
    if (env.SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: 'custom',
        path: ['SUPABASE_SERVICE_ROLE_KEY'],
        message: 'SUPABASE_SERVICE_ROLE_KEY must differ from SUPABASE_ANON_KEY.',
      });
    }
  });

/** Every variable name the schema reads (the example files must list exactly these plus the VITE_ keys). */
export const SERVER_ENV_KEYS = Object.keys(serverEnvSchema.shape) as ReadonlyArray<keyof typeof serverEnvSchema.shape>;

/** Browser-safe variables compiled into the SPA (brief §8.1). They are NOT part of the server schema. */
export const BROWSER_ENV_KEYS = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] as const;

/** The typed, frozen configuration handed to the rest of the server. */
export interface AppConfig {
  readonly appEnv: AppEnvValue;
  readonly logLevel: LogLevel;
  readonly supabase: {
    /** Project URL without a trailing slash. */
    readonly url: string;
    /** `<url>/auth/v1`: the pinned JWT issuer (brief §5.7). */
    readonly authIssuer: string;
    /** `<url>/auth/v1/.well-known/jwks.json`. */
    readonly jwksUrl: string;
    readonly anonKey: string;
    readonly serviceRoleKey: string;
  };
}

/** Maps the validated variables to the typed configuration. */
export function toAppConfig(env: z.output<typeof serverEnvSchema>): AppConfig {
  const url = env.SUPABASE_URL.replace(/\/+$/, '');
  return {
    appEnv: env.APP_ENV,
    logLevel: env.LOG_LEVEL,
    supabase: {
      url,
      authIssuer: `${url}/auth/v1`,
      jwksUrl: `${url}/auth/v1/.well-known/jwks.json`,
      anonKey: env.SUPABASE_ANON_KEY,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  };
}
