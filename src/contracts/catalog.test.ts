import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { ENDPOINT_CATALOG, ENDPOINT_MAPS, endpointById, pathsCollide } from './catalog.js';
import { validateEndpointDefinition } from './endpoint.js';
import type { AnyEndpoint } from './endpoint.js';

const contractsDir = fileURLToPath(new URL('.', import.meta.url));

function isEndpoint(value: unknown): value is AnyEndpoint {
  return typeof value === 'object' && value !== null && 'id' in value && 'method' in value && 'path' in value && 'response' in value;
}

/**
 * Every endpoint exported by any contract module (`export const <name>Endpoints = {…}`), including maps a domain
 * has added but the Integration step has not listed in catalog.ts yet, so route conflicts surface immediately.
 */
async function discoverAllEndpoints(): Promise<{ maps: string[]; endpoints: AnyEndpoint[] }> {
  const maps: string[] = [];
  const endpoints: AnyEndpoint[] = [];
  const modules = readdirSync(contractsDir).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
  for (const name of modules.sort()) {
    const exports = (await import(pathToFileURL(`${contractsDir}${name}`).href)) as Record<string, unknown>;
    for (const [exportName, value] of Object.entries(exports)) {
      if (!exportName.endsWith('Endpoints') || typeof value !== 'object' || value === null) continue;
      maps.push(exportName);
      endpoints.push(...Object.values(value).filter(isEndpoint));
    }
  }
  return { maps, endpoints: [...new Set(endpoints)] };
}

let discovered: { maps: string[]; endpoints: AnyEndpoint[] };

beforeAll(async () => {
  discovered = await discoverAllEndpoints();
});

describe('endpoint catalog', () => {
  it('lists every endpoint of every aggregated map exactly once', () => {
    // Arrange
    const expected = Object.values(ENDPOINT_MAPS).reduce((total, map) => total + Object.keys(map).length, 0);

    // Act + Assert
    expect(ENDPOINT_CATALOG).toHaveLength(expected);
    expect(new Set(ENDPOINT_CATALOG).size).toBe(expected);
  });

  it('keeps every contract valid', () => {
    const problems = discovered.endpoints.flatMap((endpoint) =>
      validateEndpointDefinition(endpoint).map((problem) => `${endpoint.id}: ${problem}`),
    );
    expect(problems).toEqual([]);
  });

  it('uses unique ids and unique method + path pairs across every contract module', () => {
    const ids = discovered.endpoints.map((endpoint) => endpoint.id);
    const routes = discovered.endpoints.map((endpoint) => `${endpoint.method} ${endpoint.path}`);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
    expect(routes.filter((route, index) => routes.indexOf(route) !== index)).toEqual([]);
  });

  it('has no two routes of the same method that could match the same request path', () => {
    const collisions: string[] = [];
    discovered.endpoints.forEach((left, index) => {
      for (const right of discovered.endpoints.slice(index + 1)) {
        if (left.method === right.method && pathsCollide(left.path, right.path)) {
          collisions.push(`${left.method} ${left.path} (${left.id}) <> ${right.path} (${right.id})`);
        }
      }
    });
    expect(collisions).toEqual([]);
  });

  it('contains only endpoints that the contract modules export', () => {
    const exported = new Set(discovered.endpoints);
    expect(ENDPOINT_CATALOG.filter((endpoint) => !exported.has(endpoint)).map((endpoint) => endpoint.id)).toEqual([]);
  });

  it('finds an endpoint by id and returns undefined for an unknown id', () => {
    expect(endpointById('me.session.context')?.path).toBe('/api/v1/me/context');
    expect(endpointById('no.such.endpoint')).toBeUndefined();
  });

  it('flags a static segment facing a parameter but not distinct or identical static routes', () => {
    expect(pathsCollide('/api/v1/me/tasks/:taskId', '/api/v1/me/tasks/summary')).toBe(true);
    expect(pathsCollide('/api/v1/me/task-summary', '/api/v1/me/tasks')).toBe(false);
    expect(pathsCollide('/api/v1/me/tasks', '/api/v1/me/tasks')).toBe(false);
  });
});
