/**
 * Tests of the mock-platform scripts: the node:http bridge of serve-mock-api, the persona seeding guards, the
 * OpenAPI generator, and the CI scans (secrets, bundle, test-run floor).
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { defineEndpoint } from '../../../contracts/endpoint.js';
import { getSessionContext, sessionEndpoints, updateTheme } from '../../../contracts/session.js';
import { evaluateReport } from '../../../../scripts/ci/assert-test-run.js';
import { bundleRules, checkProductionCsp, findDemoAccountsMarker, scanBundle, scanBundleText } from '../../../../scripts/ci/scan-bundle.js';
import { scanText } from '../../../../scripts/ci/scan-secrets.js';
import { buildOpenApiDocument, collectEndpoints, discoverContractEndpoints, endpointsOfModule } from '../../../../scripts/docs/generate-openapi.js';
import { isLocalTarget, seedAccounts } from '../../../../scripts/dev/seed-auth-personas.js';
import { loadLocalEnv, parseServeArgs, toFetchRequest, writeFetchResponse } from '../../../../scripts/dev/serve-mock-api.js';
import { PERSONAS } from '../../fixtures/platform.js';
import { createTestMockApp } from '../index.js';
import { base64url } from '../../../server/tests/unit/platform-auth/jwt-helpers.js';

let scratch: string;

beforeAll(() => {
  scratch = mkdtempSync(join(tmpdir(), 'tenderiq-mock-platform-'));
});

afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('serve-mock-api', () => {
  it('parses --port and --host in both spellings and rejects anything else', () => {
    expect(parseServeArgs([])).toEqual({ port: 3001, host: '127.0.0.1' });
    expect(parseServeArgs(['--port', '4101'])).toEqual({ port: 4101, host: '127.0.0.1' });
    expect(parseServeArgs(['--port=4190', '--host=localhost'])).toEqual({ port: 4190, host: 'localhost' });
    expect(() => parseServeArgs(['--port', '70000'])).toThrow(/--port/);
    expect(() => parseServeArgs(['--verbose'])).toThrow(/Unknown argument/);
  });

  it('loads an env file only when it exists, so the plain `npx tsx` command works without --env-file', () => {
    // Arrange
    const present = join(scratch, 'present.env');
    writeFileSync(present, '# no variables: loading must not change the test environment\n');

    // Act + Assert
    expect(loadLocalEnv(join(scratch, 'absent.env'))).toBe(false);
    expect(loadLocalEnv(present)).toBe(true);
  });

  it('bridges node:http requests and responses to the Hono app, including bodies and headers', async () => {
    // Arrange
    const api = await createTestMockApp({ auth: 'fixture' });
    const server = createServer((request, response) => {
      void toFetchRequest(request, 'http://127.0.0.1')
        .then((fetchRequest) => api.fetch(fetchRequest))
        .then((fetchResponse) => writeFetchResponse(fetchResponse, response));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      // Act
      const health = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { headers: { 'x-correlation-id': 'bridge-1' } });
      const theme = await fetch(`http://127.0.0.1:${port}/api/v1/me/theme`, {
        method: 'PUT',
        headers: { authorization: 'Bearer fixture-persona.tebogo.officer@tenderiq.local', 'content-type': 'application/json' },
        body: JSON.stringify({ theme: 'dark' }),
      });

      // Assert
      expect(health.status).toBe(200);
      expect(health.headers.get('x-correlation-id')).toBe('bridge-1');
      expect(await health.json()).toEqual({ status: 'ok', version: 'v1' });
      expect(theme.status).toBe(200);
      expect(await theme.json()).toEqual({ theme: 'dark' });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

describe('seed-auth-personas', () => {
  it('refuses every target that is not the local stack', () => {
    const local = { appEnv: 'local' as const, supabase: { url: 'http://127.0.0.1:54321' } };
    expect(isLocalTarget(local as never)).toBe(true);
    expect(isLocalTarget({ ...local, supabase: { url: 'http://localhost:54321' } } as never)).toBe(true);
    expect(isLocalTarget({ ...local, supabase: { url: 'https://abc.supabase.co' } } as never)).toBe(false);
    expect(isLocalTarget({ ...local, appEnv: 'dev', supabase: { url: 'http://127.0.0.1:54321' } } as never)).toBe(false);
  });

  it('provisions every persona plus the unmapped proof account, once each', () => {
    const accounts = seedAccounts();
    expect(accounts).toHaveLength(PERSONAS.length + 1);
    expect(new Set(accounts.map((account) => account.email)).size).toBe(accounts.length);
    expect(accounts.map((account) => account.email)).toContain('unmapped.account@tenderiq.local');
  });
});

describe('generate-openapi', () => {
  it('finds endpoint maps in module exports and ignores other exports', () => {
    const found = endpointsOfModule({ sessionEndpoints, getSessionContext, SOME_CONSTANT: ['a'], helper: () => 1 });
    expect(found).toEqual([getSessionContext, updateTheme]);
  });

  it('deduplicates the same endpoint object re-exported by a catalog', () => {
    const endpoints = collectEndpoints([
      { source: 'session.ts', endpoints: [getSessionContext, updateTheme] },
      { source: 'catalog.ts', endpoints: [getSessionContext, updateTheme] },
    ]);
    expect(endpoints).toHaveLength(2);
  });

  it('fails on two different endpoints with the same id or the same method and path', () => {
    const sameRoute = defineEndpoint({
      id: 'me.session.contextAgain',
      method: 'GET',
      path: '/api/v1/me/context',
      audience: 'me',
      response: z.object({}),
      errors: [],
      screens: ['COM-02'],
    });
    const sameId = defineEndpoint({ ...sameRoute, id: 'me.session.context', path: '/api/v1/me/other' });
    expect(() => collectEndpoints([{ source: 'a.ts', endpoints: [getSessionContext, sameRoute] }])).toThrow(/duplicate route/);
    expect(() => collectEndpoints([{ source: 'a.ts', endpoints: [getSessionContext, sameId] }])).toThrow(/duplicate endpoint id/);
  });

  it('builds an OpenAPI 3.1 document from every contract module', async () => {
    // Act
    const endpoints = await discoverContractEndpoints();
    const document = buildOpenApiDocument(endpoints) as {
      openapi: string;
      paths: Record<string, Record<string, { operationId: string; parameters: Array<{ name: string }>; 'x-tenant-header': string }>>;
    };

    // Assert
    expect(document.openapi).toBe('3.1.0');
    expect(endpoints.length).toBeGreaterThan(2);
    expect(document.paths['/api/v1/health']?.get?.operationId).toBe('health');
    const context = document.paths['/api/v1/me/context']?.get;
    expect(context?.operationId).toBe('me.session.context');
    expect(context?.parameters.map((parameter) => parameter.name)).toEqual(['tenantId']);
    expect(context?.['x-tenant-header']).toBe('none');
    expect(() => JSON.stringify(document)).not.toThrow();
  });
});

describe('scan-secrets', () => {
  it('flags JWT-shaped keys, Supabase secrets, private keys and credentialed URLs without echoing them', () => {
    // Arrange
    const jwt = `${base64url('{"alg":"ES256","typ":"JWT"}')}.${base64url('{"role":"service_role","iss":"x"}')}.${'s'.repeat(40)}`;
    const text = [
      `SUPABASE_SERVICE_ROLE_KEY=${jwt}`,
      // Assembled at runtime so this file itself never contains a secret-shaped literal (scan-secrets scans it).
      `key = "${['sb', 'secret', 'abcdefghijklmnop'].join('_')}"`,
      `-----BEGIN EC ${'PRIVATE'} KEY-----`,
      `DATABASE=${['postgres://svc', 'realpassword@db:5432/app'].join(':')}`,
    ].join('\n');

    // Act
    const findings = scanText('fixture.env', text);

    // Assert
    expect(findings.map((finding) => [finding.rule, finding.line])).toEqual([
      ['jwt', 1],
      ['supabase-secret-key', 2],
      ['pem-private-key', 3],
      ['credentialed-url', 4],
    ]);
    expect(JSON.stringify(findings)).not.toContain('realpassword');
  });

  it('accepts documented placeholders', () => {
    const text = 'SUPABASE_DIRECT_DATABASE_URL=postgresql://postgres:<local-db-password>@127.0.0.1:54322/postgres\nSUPABASE_ANON_KEY=<local-anon-key>';
    expect(scanText('.env.local.example', text)).toEqual([]);
  });
});

describe('scan-bundle', () => {
  const inputs = { serviceRoleKey: 'super-secret-service-role-value', demoAccountsMarker: 'tiq-demo-accounts-dev-only-marker' };

  it.each([
    ['a persona e-mail', 'const a="tebogo.officer@tenderiq.local"', 'mock-fixture'],
    ['a server variable name', 'const k="SUPABASE_SERVICE_ROLE_KEY"', 'server-env-name'],
    ['server code', 'throw new Error("Invalid server configuration")', 'server-code'],
    ['the configured service-role key', 'x="super-secret-service-role-value"', 'service-role-key'],
    ['the demo-accounts marker', 'data-x="tiq-demo-accounts-dev-only-marker"', 'demo-accounts-marker'],
  ])('flags %s', (_label, text, rule) => {
    expect(scanBundleText('assets/index.js', text, bundleRules(inputs)).map((finding) => finding.rule)).toContain(rule);
  });

  it('flags a JWT whose role is service_role but not the anon key', () => {
    const jwt = (role: string) => `${base64url('{"alg":"ES256","typ":"JWT"}')}.${base64url(JSON.stringify({ role, iss: 'x' }))}.${'s'.repeat(40)}`;
    expect(scanBundleText('a.js', `k="${jwt('service_role')}"`, bundleRules(inputs)).map((finding) => finding.rule)).toEqual(['service-role-jwt']);
    expect(scanBundleText('a.js', `k="${jwt('anon')}"`, bundleRules(inputs))).toEqual([]);
  });

  it('allows the browser-safe VITE_ variable names', () => {
    const text = 'const u="VITE_SUPABASE_URL",k="VITE_SUPABASE_ANON_KEY";';
    expect(scanBundleText('a.js', text, bundleRules(inputs))).toEqual([]);
  });

  it('scans every file of a dist directory', () => {
    // Arrange
    const dist = join(scratch, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    writeFileSync(join(dist, 'index.html'), '<html><body>clean</body></html>');
    writeFileSync(join(dist, 'assets', 'app.js'), 'console.warn("SUPABASE_SERVICE_ROLE_KEY")');

    // Act
    const findings = scanBundle(dist, inputs);

    // Assert
    expect(findings.map((finding) => [finding.file.replace(/\\/g, '/'), finding.rule])).toEqual([['assets/app.js', 'server-env-name']]);
  });

  it('reads the DEMO_ACCOUNTS_MARKER declaration from the SPA auth sources', () => {
    const authDir = join(scratch, 'auth');
    mkdirSync(authDir, { recursive: true });
    writeFileSync(join(authDir, 'DemoAccounts.tsx'), "export const DEMO_ACCOUNTS_MARKER = 'tiq-demo-accounts-0f3c';\n");
    expect(findDemoAccountsMarker(authDir)).toBe('tiq-demo-accounts-0f3c');
    expect(findDemoAccountsMarker(join(scratch, 'missing'))).toBeNull();
  });

  it('accepts the production CSP and rejects a missing, unfilled or dev-relaxed policy', () => {
    const page = (policy: string) => `<head><meta http-equiv="Content-Security-Policy" content="${policy}" /></head>`;
    const production = "default-src 'self'; script-src 'self'; connect-src 'self' http://127.0.0.1:54321";
    expect(checkProductionCsp(page(production))).toEqual([]);
    expect(checkProductionCsp('<head></head>').map((finding) => finding.context)).toEqual(['no Content-Security-Policy meta tag']);
    expect(checkProductionCsp(page('__TENDERIQ_CONTENT_SECURITY_POLICY__')).map((finding) => finding.context)).toEqual([
      'the policy token was not replaced',
    ]);
    expect(checkProductionCsp(page("default-src 'self'; script-src 'self' 'unsafe-inline' ws:")).map((finding) => finding.context)).toEqual([
      "script-src allows 'unsafe-inline'",
      'script-src allows ws:',
    ]);
  });
});

describe('assert-test-run', () => {
  const passed = { status: 'passed', fullName: 'a' };

  it('accepts a complete, passing run above the floor', () => {
    const verdict = evaluateReport({ success: true, numTotalTests: 2, numPassedTests: 2, testResults: [{ assertionResults: [passed, passed] }] }, 2);
    expect(verdict).toMatchObject({ ok: true, total: 2, passed: 2 });
  });

  it('fails on skipped or todo tests even when everything else passed', () => {
    const verdict = evaluateReport(
      { success: true, numTotalTests: 2, numPassedTests: 1, numPendingTests: 1, testResults: [{ name: 'x.test.ts', assertionResults: [passed, { status: 'skipped', fullName: 'b' }] }] },
      1,
    );
    expect(verdict.ok).toBe(false);
    expect(verdict.problems.join(' ')).toContain('skipped');
  });

  it('fails on failures and below the floor', () => {
    expect(evaluateReport({ success: false, numTotalTests: 1, numFailedTests: 1, testResults: [{ assertionResults: [{ status: 'failed' }] }] }, 1).ok).toBe(false);
    expect(evaluateReport({ success: true, numTotalTests: 1, numPassedTests: 1, testResults: [{ assertionResults: [passed] }] }, 5).problems).toEqual([
      'only 1 test(s) ran; the floor is 5',
    ]);
  });
});
