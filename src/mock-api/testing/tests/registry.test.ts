/**
 * Handler auto-discovery and isolation (registry.ts): a module that fails to import, has no `register`, throws while
 * registering or claims another module's route is logged and skipped; the others keep serving.
 */
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createTestMockApp } from '../index.js';
import { DEFAULT_HANDLERS_DIR, discoverHandlerModules, listHandlerFiles, registerModules } from '../../registry.js';
import { MockRouteCollector, mockRoute } from '../../middleware/routes.js';
import { updateTheme } from '../../../contracts/session.js';

const SAMPLES = fileURLToPath(new URL('../registry-samples/', import.meta.url));
const TESTS_DIR = fileURLToPath(new URL('./', import.meta.url));

describe('listHandlerFiles', () => {
  it('finds *.ts modules and <dir>/index.ts in a stable order', () => {
    expect(listHandlerFiles(SAMPLES).map((entry) => entry.name)).toEqual([
      'a-good',
      'b-import-fails',
      'c-no-register',
      'd-register-throws',
      'e-conflict',
      'good-dir/index',
    ]);
  });

  it('skips test files', () => {
    const names = listHandlerFiles(TESTS_DIR).map((entry) => entry.name);
    expect(names.some((name) => name.endsWith('.test'))).toBe(false);
    expect(names).toContain('platform-endpoints');
  });

  it('returns nothing for a missing directory', () => {
    expect(listHandlerFiles(`${SAMPLES}does-not-exist`)).toEqual([]);
  });

  it('discovers the session module in the real handlers directory', () => {
    expect(listHandlerFiles(DEFAULT_HANDLERS_DIR).map((entry) => entry.name)).toContain('session');
  });
});

describe('module isolation', () => {
  it('loads the good modules and reports each broken one with its stage', async () => {
    // Act
    const api = await createTestMockApp({ handlersDir: SAMPLES, auth: 'fixture' });

    // Assert
    expect(api.loaded).toEqual(['a-good', 'good-dir/index']);
    expect(api.failed.map((failure) => [failure.module, failure.stage])).toEqual([
      ['b-import-fails', 'import'],
      ['c-no-register', 'shape'],
      ['d-register-throws', 'register'],
      ['e-conflict', 'conflict'],
    ]);
    expect(api.logs.filter((line) => line.includes('handler module skipped'))).toHaveLength(4);
  });

  it('keeps serving the good modules and drops every route of a module that failed midway', async () => {
    // Arrange
    const api = await createTestMockApp({ handlersDir: SAMPLES, auth: 'fixture' });

    // Act
    const good = await api.request('GET', '/api/v1/public/registry-sample/ping');
    const directory = await api.request('GET', '/api/v1/public/registry-sample/directory');
    const partial = await api.request('GET', '/api/v1/public/registry-sample/partial');

    // Assert
    expect(good).toMatchObject({ status: 200, body: { pong: true } });
    expect(directory).toMatchObject({ status: 200, body: { from: 'directory' } });
    expect(partial.status).toBe(404);
  });

  it('returns import and shape failures from discovery instead of throwing', async () => {
    const { modules, failed } = await discoverHandlerModules(SAMPLES);
    expect(modules.map((module) => module.name)).toEqual(['a-good', 'd-register-throws', 'e-conflict', 'good-dir/index']);
    expect(failed).toHaveLength(2);
  });

  it('rejects a module that registers the same route twice and mounts none of its routes', () => {
    // Arrange
    const target = new MockRouteCollector('target');

    // Act
    const result = registerModules(target, [
      {
        name: 'twice',
        register: (app) => {
          mockRoute(app, updateTheme, ({ body }) => ({ theme: body.theme }));
          mockRoute(app, updateTheme, () => ({ theme: 'light' }));
        },
      },
    ]);

    // Assert
    expect(result.loaded).toEqual([]);
    expect(result.failed).toEqual([{ module: 'twice', stage: 'register', message: 'Route PUT /api/v1/me/theme is registered twice.' }]);
    expect(target.records).toHaveLength(0);
  });
});
