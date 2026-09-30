/**
 * Serves the Stage A mock API over node:http (architecture-plan §3.11; docs/technical/07-api.md §11).
 *
 * Usage: tsx scripts/dev/serve-mock-api.ts [--port 3001] [--host 127.0.0.1]
 *   (`npm run dev:mock-api` uses port 3001; agents and Playwright pass their own port.)
 *
 * - Loads the repository's `.env.local` itself when it exists (so the command works with or without tsx's
 *   `--env-file-if-exists`); variables already set in the environment win.
 *
 * - Validates the configuration first (src/server/lib/config): a bad `.env.local` stops with the list of bad
 *   variables instead of failing on the first request.
 * - Bridges node:http ⇄ the Hono fetch handler; request bodies are buffered (limit 10 MB).
 * - Binds to 127.0.0.1 by default (never a public interface). Stops cleanly on SIGINT/SIGTERM.
 */
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createMockApp } from '../../src/mock-api/app.js';
import { ConfigurationError, getConfig } from '../../src/server/lib/config/index.js';

const MAX_BODY_BYTES = 10 * 1024 * 1024;
const ENV_LOCAL = fileURLToPath(new URL('../../.env.local', import.meta.url));

/** Loads `.env.local` from the repository root when present; existing environment variables are not overridden. */
export function loadLocalEnv(path: string = ENV_LOCAL): boolean {
  if (!existsSync(path)) {
    return false;
  }
  process.loadEnvFile(path);
  return true;
}

export interface ServeOptions {
  readonly port: number;
  readonly host: string;
}

/** Parses `--port <n>` / `--port=<n>` and `--host <h>`. */
export function parseServeArgs(argv: readonly string[]): ServeOptions {
  let port = 3001;
  let host = '127.0.0.1';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? '';
    const [flag, inline] = arg.includes('=') ? [arg.slice(0, arg.indexOf('=')), arg.slice(arg.indexOf('=') + 1)] : [arg, undefined];
    const value = inline ?? argv[index + 1];
    if (flag === '--port') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new Error(`--port must be an integer between 1 and 65535, got "${value ?? ''}".`);
      }
      port = parsed;
      if (inline === undefined) index += 1;
    } else if (flag === '--host') {
      if (value === undefined || value === '') {
        throw new Error('--host needs a value.');
      }
      host = value;
      if (inline === undefined) index += 1;
    } else {
      throw new Error(`Unknown argument "${arg}". Usage: serve-mock-api.ts [--port 3001] [--host 127.0.0.1]`);
    }
  }
  return { port, host };
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

/** Converts a node request to a fetch Request. */
export async function toFetchRequest(request: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      headers.append(name, item);
    }
  }
  const method = request.method ?? 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(request);
  return new Request(new URL(request.url ?? '/', origin), {
    method,
    headers,
    ...(body === undefined || body.length === 0 ? {} : { body: new Uint8Array(body) }),
  });
}

/** Writes a fetch Response to a node response. */
export async function writeFetchResponse(response: Response, target: ServerResponse): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((value, name) => {
    headers[name] = value;
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) {
    headers['set-cookie'] = cookies;
  }
  target.writeHead(response.status, headers);
  target.end(Buffer.from(await response.arrayBuffer()));
}

async function main(): Promise<void> {
  let options: ServeOptions;
  try {
    options = parseServeArgs(process.argv.slice(2));
    loadLocalEnv();
    getConfig();
  } catch (error) {
    const message = error instanceof ConfigurationError ? `${error.message}\nWrite .env.local (see docs/local-development.md).` : error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
    return;
  }
  const api = await createMockApp();
  const origin = `http://${options.host.includes(':') ? `[${options.host}]` : options.host}:${options.port}`;
  const server = createServer((request, response) => {
    toFetchRequest(request, origin)
      .then((fetchRequest) => api.fetch(fetchRequest))
      .then((fetchResponse) => writeFetchResponse(fetchResponse, response))
      .catch((error: unknown) => {
        console.error(`mock-api bridge error: ${error instanceof Error ? error.message : String(error)}`);
        if (!response.headersSent) {
          response.writeHead(error instanceof Error && error.message === 'Request body too large.' ? 413 : 500, {
            'content-type': 'text/plain',
          });
        }
        response.end();
      });
  });
  server.on('error', (error) => {
    process.stderr.write(`Mock API could not start on ${origin}: ${error.message}\n`);
    process.exitCode = 1;
  });
  server.listen(options.port, options.host, () => {
    process.stdout.write(
      `Mock API (prototype, static fixtures) listening on ${origin}/api/v1 with ${api.endpointIds.length} endpoints from ` +
        `${api.loaded.length} handler modules${api.failed.length > 0 ? `; ${api.failed.length} module(s) skipped (see log)` : ''}.\n`,
    );
  });
  const shutdown = (): void => {
    server.close(() => process.exit(0));
    server.closeAllConnections();
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    process.stderr.write(`Mock API failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
