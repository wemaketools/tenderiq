/**
 * `npm run dev:prototype`: the Stage A prototype on the owner's ports (architecture-plan §3.11, §9).
 *
 * Starts, side by side:
 *   [mock-api]  tsx watch scripts/dev/serve-mock-api.ts --port 3001   (reads .env.local; real JWT verification, DD-43;
 *               watch mode restarts it when contracts or mock code change, so it never serves stale responses
 *               while Vite hot-reloads the SPA against the new contracts)
 *   [vite]      vite --port 5173 in src/ui                       (proxies /api to 127.0.0.1:3001)
 *
 * - Output of both is line-prefixed. When either process exits, or on Ctrl+C / SIGTERM, both are stopped (the
 *   whole process tree on Windows) and this script exits with the first non-zero code.
 * - Sign-in is real: the local Supabase stack must be running (`npm run supabase:start`) and the demo accounts must
 *   exist (`npm run auth:personas`).
 * - Children inherit the environment unchanged; configuration is read by src/server/lib/config (mock API) and by
 *   Vite from the root .env.local (SPA).
 *
 * Usage: npm run dev:prototype
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const uiDir = fileURLToPath(new URL('../../src/ui/', import.meta.url));
const tsxCli = fileURLToPath(new URL('../../node_modules/tsx/dist/cli.mjs', import.meta.url));
const viteCli = fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url));

const MOCK_API_PORT = 3001;
const VITE_PORT = 5173;

const COLORS = { 'mock-api': '\u001b[36m', vite: '\u001b[35m' };
const RESET = '\u001b[0m';

/**
 * @param {string} name
 * @param {string} line
 * @param {NodeJS.WriteStream} stream
 */
function writePrefixed(name, line, stream) {
  const color = stream.isTTY ? COLORS[/** @type {keyof typeof COLORS} */ (name)] : '';
  stream.write(`${color}[${name}]${stream.isTTY ? RESET : ''} ${line}\n`);
}

for (const [label, file] of [
  ['tsx', tsxCli],
  ['vite', viteCli],
]) {
  if (!existsSync(file)) {
    process.stderr.write(`Cannot find ${label} at ${file}. Run npm install first.\n`);
    process.exit(1);
  }
}
if (!existsSync(fileURLToPath(new URL('../../.env.local', import.meta.url)))) {
  process.stderr.write('Missing .env.local at the repository root (see docs/local-development.md).\n');
  process.exit(1);
}

/** @type {Array<{ name: string, child: import('node:child_process').ChildProcess }>} */
const children = [];
let shuttingDown = false;
let exitCode = 0;

/**
 * @param {string} name
 * @param {string[]} args
 * @param {string} cwd
 */
function start(name, args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.push({ name, child });
  if (child.stdout) {
    createInterface({ input: child.stdout }).on('line', (line) => writePrefixed(name, line, process.stdout));
  }
  if (child.stderr) {
    createInterface({ input: child.stderr }).on('line', (line) => writePrefixed(name, line, process.stderr));
  }
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      writePrefixed(name, `exited (${signal ?? `code ${code ?? 0}`}); stopping the other process.`, process.stderr);
      exitCode = code === null || code === 0 ? 1 : code;
      shutdown();
    }
  });
  child.on('error', (error) => {
    writePrefixed(name, `failed to start: ${error.message}`, process.stderr);
    exitCode = 1;
    shutdown();
  });
  return child;
}

/** @param {import('node:child_process').ChildProcess} child */
function stop(child) {
  if (child.exitCode !== null || child.pid === undefined) {
    return;
  }
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const { child } of children) {
    stop(child);
  }
  setTimeout(() => process.exit(exitCode), 500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.stdout.write(
  `TenderIQ prototype: mock API http://127.0.0.1:${MOCK_API_PORT}/api/v1, SPA http://localhost:${VITE_PORT}\n` +
    'Requires the local Supabase stack (npm run supabase:start) and the demo accounts (npm run auth:personas).\n',
);

start('mock-api', [tsxCli, 'watch', '--clear-screen=false', '--env-file-if-exists=.env.local', 'scripts/dev/serve-mock-api.ts', '--port', String(MOCK_API_PORT)], root);
start('vite', [viteCli, '--port', String(VITE_PORT), '--strictPort'], uiDir);
