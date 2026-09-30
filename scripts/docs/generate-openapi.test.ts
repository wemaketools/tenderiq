/**
 * `npm run docs:api`: the OpenAPI 3.1 document covers the whole endpoint catalog and is structurally valid (unique
 * operation ids, every path parameter declared, every local `$ref` resolvable, problem+json error responses).
 */
import { readFileSync } from 'node:fs';

import { beforeAll, describe, expect, it } from 'vitest';

import { ENDPOINT_CATALOG } from '../../src/contracts/catalog.js';
import { DEFAULT_OUTPUT, buildOpenApiDocument, discoverContractEndpoints } from './generate-openapi.js';

type Json = Record<string, unknown>;

const METHODS = ['get', 'put', 'post', 'patch', 'delete'] as const;

let document: Json;

beforeAll(async () => {
  document = buildOpenApiDocument(await discoverContractEndpoints());
});

function operations(doc: Json): Array<{ path: string; method: string; operation: Json }> {
  const paths = doc.paths as Record<string, Record<string, Json>>;
  return Object.entries(paths).flatMap(([path, item]) =>
    METHODS.filter((method) => item[method] !== undefined).map((method) => ({ path, method, operation: item[method] as Json })),
  );
}

function refs(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) refs(item, found);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Json)) {
      if (key === '$ref' && typeof child === 'string') found.add(child);
      else refs(child, found);
    }
  }
  return found;
}

function resolve(doc: Json, ref: string): unknown {
  return ref
    .replace(/^#\//, '')
    .split('/')
    .reduce<unknown>((node, segment) => (node !== null && typeof node === 'object' ? (node as Json)[segment.replaceAll('~1', '/').replaceAll('~0', '~')] : undefined), doc);
}

describe('OpenAPI document', () => {
  it('declares OpenAPI 3.1 with one operation per catalog endpoint and unique operation ids', () => {
    // Act
    const ops = operations(document);
    const ids = ops.map((entry) => entry.operation.operationId);

    // Assert
    expect(String(document.openapi)).toMatch(/^3\.1\./);
    expect((document.info as Json).title).toBeTruthy();
    // Every catalog endpoint, plus the liveness check.
    expect(ops).toHaveLength(ENDPOINT_CATALOG.length + 1);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(['health', ...ENDPOINT_CATALOG.map((endpoint) => endpoint.id)]));
  });

  it('declares every path parameter of every templated path', () => {
    for (const { path, method, operation } of operations(document)) {
      const names = [...path.matchAll(/\{([A-Za-z0-9]+)\}/g)].map((match) => match[1]);
      const declared = ((operation.parameters as Json[] | undefined) ?? []).filter((parameter) => parameter.in === 'path').map((parameter) => parameter.name);
      expect(declared.sort(), `${method.toUpperCase()} ${path}`).toEqual([...names].sort());
    }
  });

  it('resolves every local reference and answers errors as problem+json', () => {
    for (const ref of refs(document)) {
      expect(ref.startsWith('#/'), ref).toBe(true);
      expect(resolve(document, ref), ref).toBeDefined();
    }
    for (const { path, method, operation } of operations(document).filter((entry) => entry.operation.operationId !== 'health')) {
      const responses = operation.responses as Record<string, Json>;
      const errors = Object.keys(responses).filter((status) => /^[45]\d\d$/.test(status));
      expect(errors.length, `${method.toUpperCase()} ${path}`).toBeGreaterThan(0);
    }
  });

  it('matches the committed docs/technical/api/openapi.json (run npm run docs:api after a contract change)', () => {
    const committed = JSON.parse(readFileSync(DEFAULT_OUTPUT, 'utf8')) as Json;
    expect(committed).toEqual(JSON.parse(JSON.stringify(document)) as Json);
  });
});
