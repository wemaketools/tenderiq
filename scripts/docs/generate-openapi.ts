/**
 * `npm run docs:api`: generates the OpenAPI 3.1 document of the contracts (architecture-plan §3.10;
 * docs/technical/07-api.md §10).
 *
 * - Auto-discovers the endpoint maps exported from `src/contracts/*.ts` (test files excluded): every exported plain
 *   object whose members are all defined endpoints. `catalog.ts` re-exporting the same endpoint objects is fine;
 *   two DIFFERENT endpoints with the same id, or the same method + path, fail the run.
 * - Schemas are converted with zod v4's built-in `z.toJSONSchema()` (requests as input shapes, responses as output
 *   shapes). No dependency is added.
 * - Each endpoint becomes one operation: `operationId` = the endpoint id, tag = the audience, path/query parameters,
 *   JSON request body, the success response, and problem+json responses for the platform statuses and the declared
 *   business `errors`. Extension members carry what OpenAPI has no field for: `x-permission`, `x-screens`,
 *   `x-tenant-header` (none/active/row, DD-21), `x-idempotent` (DD-39) and `x-error-codes`.
 *
 * Usage: npm run docs:api [-- --out <file>]   (default docs/technical/api/openapi.json)
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { z } from 'zod';

import { Problem } from '../../src/contracts/common.js';
import type { AnyEndpoint } from '../../src/contracts/endpoint.js';
import { HEALTH_PATH, endpointPermissions, tenantHeaderMode } from '../../src/contracts/endpoint.js';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export const CONTRACTS_DIR = join(repoRoot, 'src', 'contracts');
export const DEFAULT_OUTPUT = join(repoRoot, 'docs', 'technical', 'api', 'openapi.json');

type JsonSchema = Record<string, unknown>;

/** True for a value produced by `defineEndpoint`. */
export function isEndpoint(value: unknown): value is AnyEndpoint {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<AnyEndpoint>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.method === 'string' &&
    typeof candidate.path === 'string' &&
    typeof candidate.audience === 'string' &&
    typeof candidate.status === 'number' &&
    Array.isArray(candidate.pathParams) &&
    candidate.response !== undefined
  );
}

/** The endpoints of a module's exports: members of every exported object whose values are all endpoints. */
export function endpointsOfModule(moduleExports: Record<string, unknown>): AnyEndpoint[] {
  const found: AnyEndpoint[] = [];
  for (const value of Object.values(moduleExports)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) || isEndpoint(value)) {
      continue;
    }
    const members = Object.values(value as Record<string, unknown>);
    if (members.length > 0 && members.every(isEndpoint)) {
      found.push(...members);
    }
  }
  return found;
}

/** Deduplicates by identity and fails on distinct endpoints sharing an id or a method + path. */
export function collectEndpoints(groups: ReadonlyArray<{ source: string; endpoints: readonly AnyEndpoint[] }>): AnyEndpoint[] {
  const seen = new Set<AnyEndpoint>();
  const byId = new Map<string, { endpoint: AnyEndpoint; source: string }>();
  const byRoute = new Map<string, { endpoint: AnyEndpoint; source: string }>();
  const problems: string[] = [];
  const result: AnyEndpoint[] = [];
  for (const { source, endpoints } of groups) {
    for (const endpoint of endpoints) {
      if (seen.has(endpoint)) {
        continue;
      }
      seen.add(endpoint);
      const route = `${endpoint.method} ${endpoint.path.replace(/:[A-Za-z][A-Za-z0-9]*/g, ':')}`;
      const sameId = byId.get(endpoint.id);
      if (sameId !== undefined) {
        problems.push(`duplicate endpoint id "${endpoint.id}" in ${sameId.source} and ${source}`);
      }
      const sameRoute = byRoute.get(route);
      if (sameRoute !== undefined) {
        problems.push(`duplicate route ${route} ("${sameRoute.endpoint.id}" in ${sameRoute.source}, "${endpoint.id}" in ${source})`);
      }
      byId.set(endpoint.id, { endpoint, source });
      byRoute.set(route, { endpoint, source });
      result.push(endpoint);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Contract catalog is inconsistent:\n- ${problems.join('\n- ')}`);
  }
  return result.sort((left, right) => left.path.localeCompare(right.path) || left.method.localeCompare(right.method));
}

/** Imports every contract module and returns its endpoint groups. */
export async function discoverContractEndpoints(dir: string = CONTRACTS_DIR): Promise<AnyEndpoint[]> {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.endsWith('.d.ts'))
    .sort();
  const groups: Array<{ source: string; endpoints: AnyEndpoint[] }> = [];
  for (const name of files) {
    const moduleExports = (await import(pathToFileURL(join(dir, name)).href)) as Record<string, unknown>;
    groups.push({ source: name, endpoints: endpointsOfModule(moduleExports) });
  }
  return collectEndpoints(groups);
}

function toSchema(schema: z.ZodType, io: 'input' | 'output'): JsonSchema {
  const converted = z.toJSONSchema(schema, { target: 'draft-2020-12', io, unrepresentable: 'any' }) as JsonSchema;
  const { $schema: _ignored, ...rest } = converted;
  return rest;
}

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, '{$1}');
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No content',
};

function parameters(endpoint: AnyEndpoint): JsonSchema[] {
  const out: JsonSchema[] = [];
  const add = (schema: z.ZodType | undefined, location: 'path' | 'query'): void => {
    if (schema === undefined) {
      return;
    }
    const json = toSchema(schema, 'input');
    const properties = (json.properties ?? {}) as Record<string, JsonSchema>;
    const required = new Set(Array.isArray(json.required) ? (json.required as string[]) : []);
    for (const [name, property] of Object.entries(properties)) {
      out.push({ name, in: location, required: location === 'path' || required.has(name), schema: property });
    }
  };
  add(endpoint.params, 'path');
  add(endpoint.query, 'query');
  const mode = tenantHeaderMode(endpoint);
  if (mode !== 'none') {
    out.push({
      name: 'X-Tenant-Id',
      in: 'header',
      required: true,
      description: mode === 'row' ? 'The tenant of the /me row acted on (DD-21).' : 'The active tenant; its kind must match the audience.',
      schema: { type: 'string', pattern: '^[1-9][0-9]*$' },
    });
  }
  if (endpoint.idempotent === true) {
    out.push({ name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', maxLength: 200 } });
  }
  return out;
}

function problemRef(description: string): JsonSchema {
  return { description, content: { 'application/problem+json': { schema: { $ref: '#/components/schemas/Problem' } } } };
}

function operation(endpoint: AnyEndpoint): JsonSchema {
  const responses: Record<string, JsonSchema> = {};
  responses[String(endpoint.status)] =
    endpoint.status === 204
      ? { description: STATUS_TEXT[204] }
      : {
          description: STATUS_TEXT[endpoint.status] ?? 'Success',
          content: { 'application/json': { schema: toSchema(endpoint.response, 'output') } },
        };
  const isPublic = endpoint.audience === 'public';
  if (!isPublic) {
    responses['401'] = problemRef('No, invalid or expired token, or an unknown or inactive account.');
    responses['403'] = problemRef('Tenant access denied (one identical response) or missing permission.');
  }
  responses['404'] = problemRef('Unknown route, or a record the caller cannot see.');
  if (endpoint.params !== undefined || endpoint.query !== undefined || endpoint.body !== undefined) {
    responses['422'] = problemRef('The request does not satisfy the contract (errors[] lists each field).');
  }
  if (endpoint.errors.length > 0) {
    responses['409'] = problemRef(`Declared business errors: ${endpoint.errors.join(', ')}.`);
  }
  responses['500'] = problemRef('Unexpected error (sanitized detail and correlationId).');

  const op: JsonSchema = {
    operationId: endpoint.id,
    tags: [endpoint.audience],
    ...(endpoint.summary === undefined ? {} : { summary: endpoint.summary }),
    parameters: parameters(endpoint),
    responses,
    'x-permission': endpointPermissions(endpoint),
    'x-screens': [...endpoint.screens],
    'x-tenant-header': tenantHeaderMode(endpoint),
    'x-idempotent': endpoint.idempotent === true,
    'x-error-codes': [...endpoint.errors],
    ...(isPublic ? { security: [] } : {}),
  };
  if (endpoint.body !== undefined) {
    op.requestBody = { required: true, content: { 'application/json': { schema: toSchema(endpoint.body, 'input') } } };
  }
  return op;
}

/** Builds the OpenAPI document. */
export function buildOpenApiDocument(endpoints: readonly AnyEndpoint[]): JsonSchema {
  const paths: Record<string, Record<string, JsonSchema>> = {
    [HEALTH_PATH]: {
      get: {
        operationId: 'health',
        tags: ['public'],
        summary: 'Liveness check.',
        security: [],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { status: { const: 'ok' }, version: { const: 'v1' } },
                  required: ['status', 'version'],
                },
              },
            },
          },
        },
      },
    },
  };
  for (const endpoint of endpoints) {
    const path = openApiPath(endpoint.path);
    paths[path] ??= {};
    paths[path][endpoint.method.toLowerCase()] = operation(endpoint);
  }
  return {
    openapi: '3.1.0',
    info: {
      title: 'TenderIQ API',
      version: 'v1',
      description:
        'Generated from src/contracts by scripts/docs/generate-openapi.ts. Errors are RFC 7807 application/problem+json. ' +
        'Money and scores are decimal strings with a currency; instants are ISO 8601 UTC; deadlines carry their IANA zone.',
    },
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    servers: [{ url: '/' }],
    security: [{ bearerAuth: [] }],
    tags: ['public', 'me', 'buyer', 'supplier', 'ops'].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT (Supabase Auth, ES256)' },
      },
      schemas: { Problem: toSchema(Problem, 'output') },
    },
  };
}

function parseOut(argv: readonly string[]): string {
  const index = argv.findIndex((arg) => arg === '--out' || arg.startsWith('--out='));
  if (index === -1) {
    return DEFAULT_OUTPUT;
  }
  const arg = argv[index] ?? '';
  const value = arg.includes('=') ? arg.slice(arg.indexOf('=') + 1) : argv[index + 1];
  if (value === undefined || value === '') {
    throw new Error('--out needs a file path.');
  }
  return resolve(value);
}

async function main(): Promise<void> {
  const out = parseOut(process.argv.slice(2));
  const endpoints = await discoverContractEndpoints();
  const document = buildOpenApiDocument(endpoints);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  process.stdout.write(`Wrote ${out} (${endpoints.length} endpoints).\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`docs:api failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
