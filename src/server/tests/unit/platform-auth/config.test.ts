/** Unit tests of src/server/lib/config (brief §5.4): validation, defaults, blank handling, caching and freezing. */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConfigurationError,
  SERVER_ENV_KEYS,
  getConfig,
  loadConfig,
  resetConfigCache,
  tryGetConfig,
} from '../../../lib/config/index.js';

const VALID = {
  APP_ENV: 'local',
  LOG_LEVEL: 'debug',
  SUPABASE_URL: 'http://127.0.0.1:54321/',
  SUPABASE_ANON_KEY: 'anon-key-value',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-value',
};

afterEach(() => {
  vi.unstubAllEnvs();
  resetConfigCache();
});

function captureError(action: () => unknown): ConfigurationError {
  try {
    action();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected a ConfigurationError.');
}

describe('loadConfig', () => {
  it('maps valid variables to the typed configuration with the pinned issuer and JWKS URL', () => {
    // Act
    const config = loadConfig(VALID);

    // Assert
    expect(config).toEqual({
      appEnv: 'local',
      logLevel: 'debug',
      supabase: {
        url: 'http://127.0.0.1:54321',
        authIssuer: 'http://127.0.0.1:54321/auth/v1',
        jwksUrl: 'http://127.0.0.1:54321/auth/v1/.well-known/jwks.json',
        anonKey: 'anon-key-value',
        serviceRoleKey: 'service-role-key-value',
      },
    });
  });

  it('defaults APP_ENV to local and LOG_LEVEL to info when they are blank', () => {
    const config = loadConfig({ ...VALID, APP_ENV: '  ', LOG_LEVEL: '' });
    expect(config.appEnv).toBe('local');
    expect(config.logLevel).toBe('info');
  });

  it('lists EVERY bad variable by name and never returns a partial configuration', () => {
    // Act
    const error = captureError(() =>
      loadConfig({ APP_ENV: 'prod', LOG_LEVEL: 'verbose', SUPABASE_URL: 'not a url', SUPABASE_ANON_KEY: ' ' }),
    );

    // Assert
    expect(error.variables.sort()).toEqual(
      ['APP_ENV', 'LOG_LEVEL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'].sort(),
    );
    expect(error.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('never echoes a variable value in the error message', () => {
    const error = captureError(() => loadConfig({ ...VALID, SUPABASE_URL: ['postgres://user', 'hunter2@db'].join(':') }));
    expect(error.message).not.toContain('hunter2');
  });

  it('requires https for SUPABASE_URL outside APP_ENV=local', () => {
    const error = captureError(() => loadConfig({ ...VALID, APP_ENV: 'production' }));
    expect(error.variables).toEqual(['SUPABASE_URL']);
  });

  it('rejects a service-role key equal to the anon key', () => {
    const error = captureError(() => loadConfig({ ...VALID, SUPABASE_SERVICE_ROLE_KEY: VALID.SUPABASE_ANON_KEY }));
    expect(error.variables).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('returns a deeply frozen object', () => {
    const config = loadConfig(VALID);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.supabase)).toBe(true);
  });

  it('reads exactly the Stage A variable subset', () => {
    expect([...SERVER_ENV_KEYS].sort()).toEqual(
      ['APP_ENV', 'LOG_LEVEL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL'].sort(),
    );
  });
});

describe('getConfig', () => {
  it('parses process.env once and returns the cached object afterwards', () => {
    // Arrange
    for (const [key, value] of Object.entries(VALID)) {
      vi.stubEnv(key, value);
    }
    resetConfigCache();

    // Act
    const first = getConfig();
    vi.stubEnv('LOG_LEVEL', 'error');
    const second = getConfig();

    // Assert
    expect(second).toBe(first);
    expect(second.logLevel).toBe('debug');
  });

  it('does not cache a failed parse, so a fixed environment works on the next call', () => {
    // Arrange
    for (const [key, value] of Object.entries(VALID)) {
      vi.stubEnv(key, value);
    }
    vi.stubEnv('SUPABASE_URL', '');
    resetConfigCache();

    // Act
    const failed = tryGetConfig();
    vi.stubEnv('SUPABASE_URL', VALID.SUPABASE_URL);
    const recovered = tryGetConfig();

    // Assert
    expect(failed.ok).toBe(false);
    expect(recovered.ok).toBe(true);
  });
});
