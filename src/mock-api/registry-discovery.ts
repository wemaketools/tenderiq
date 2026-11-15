/**
 * Handler discovery on disk (Node only: tests and the registry check). The browser prototype cannot read
 * directories, so the app mounts the static list of `handler-modules.ts`; `handler-modules.test.ts` keeps that list
 * equal to what this module discovers.
 *
 * Discovery imports every `handlers/*.ts` and `handlers/<name>/index.ts` (test files and declaration files excluded)
 * in a stable alphabetical order. A module that fails to import or exports no `register` is returned as a failure,
 * never thrown.
 */
import { readdirSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { MockApp } from './middleware/routes.js';
import type { HandlerModule, RegistryFailure } from './registry.js';

/** Where handler modules live. */
export const DEFAULT_HANDLERS_DIR = fileURLToPath(new URL('./handlers/', import.meta.url));

const MODULE_FILE = /^[A-Za-z0-9_-]+\.(ts|mts|js|mjs)$/;
const EXCLUDED_FILE = /\.(test|spec)\.[cm]?[jt]s$|\.d\.[cm]?ts$/;

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** The handler module files of a directory: `*.ts` and `<dir>/index.ts`, sorted by module name. */
export function listHandlerFiles(dir: string = DEFAULT_HANDLERS_DIR): Array<{ name: string; file: string }> {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: Array<{ name: string; file: string }> = [];
  for (const entry of entries) {
    if (entry.isFile() && MODULE_FILE.test(entry.name) && !EXCLUDED_FILE.test(entry.name)) {
      found.push({ name: entry.name.replace(/\.[cm]?[jt]s$/, ''), file: join(dir, entry.name) });
    } else if (entry.isDirectory()) {
      const index = ['index.ts', 'index.mts', 'index.js', 'index.mjs']
        .map((candidate) => join(dir, entry.name, candidate))
        .find(isFile);
      if (index !== undefined) {
        found.push({ name: `${entry.name}/index`, file: index });
      }
    }
  }
  return found.sort((left, right) => left.name.localeCompare(right.name));
}

/** Imports the handler modules of a directory; import and shape failures are returned, never thrown. */
export async function discoverHandlerModules(
  dir: string = DEFAULT_HANDLERS_DIR,
): Promise<{ modules: HandlerModule[]; failed: RegistryFailure[] }> {
  const modules: HandlerModule[] = [];
  const failed: RegistryFailure[] = [];
  for (const { name, file } of listHandlerFiles(dir)) {
    let loaded: unknown;
    try {
      loaded = await import(pathToFileURL(file).href);
    } catch (error) {
      failed.push({ module: name, stage: 'import', message: error instanceof Error ? error.message : String(error) });
      continue;
    }
    const register = (loaded as { register?: unknown }).register;
    if (typeof register !== 'function') {
      failed.push({ module: name, stage: 'shape', message: 'The module does not export a register(app) function.' });
      continue;
    }
    modules.push({ name, register: register as (app: MockApp) => void });
  }
  return { modules, failed };
}
