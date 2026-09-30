/**
 * Handler auto-discovery (architecture-plan §3.11, §4 "Registries").
 *
 * At startup the mock API imports every `src/mock-api/handlers/*.ts` and `handlers/<name>/index.ts` (test files and
 * declaration files excluded), in a stable alphabetical order. Each module exports `register(app: MockApp)` and
 * calls `mockRoute(app, endpoint, handler)` for its endpoints.
 *
 * Every module is loaded IN ISOLATION: it registers into its own collector, which is merged only when the whole
 * registration succeeded. A module that fails to import, exports no `register`, throws while registering, or
 * claims a method + path (or endpoint id) another module already registered is logged and skipped; the server
 * keeps running with the others.
 *
 * The mock API is a dev/test tool: `src/server`, `api/` and the SPA never import it (lint rules + scan-bundle).
 */
import { readdirSync, statSync } from 'node:fs';
import type { Dirent } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { MockLogger } from './middleware/logger.js';
import { MockRouteCollector } from './middleware/routes.js';
import type { MockApp } from './middleware/routes.js';

/** Where handler modules live. */
export const DEFAULT_HANDLERS_DIR = fileURLToPath(new URL('./handlers/', import.meta.url));

/** A handler module: a name (for logs) and its `register` function. */
export interface HandlerModule {
  readonly name: string;
  readonly register: (app: MockApp) => void;
}

export type RegistryStage = 'import' | 'shape' | 'register' | 'conflict';

export interface RegistryFailure {
  readonly module: string;
  readonly stage: RegistryStage;
  readonly message: string;
}

export interface RegistryResult {
  /** Modules whose routes were mounted, in load order. */
  readonly loaded: string[];
  readonly failed: RegistryFailure[];
}

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
      failed.push({ module: name, stage: 'import', message: messageOf(error) });
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

/** Registers modules into `target`, each in isolation. */
export function registerModules(target: MockRouteCollector, modules: readonly HandlerModule[]): RegistryResult {
  const loaded: string[] = [];
  const failed: RegistryFailure[] = [];
  for (const module of modules) {
    const scratch = new MockRouteCollector(module.name);
    try {
      module.register(scratch);
    } catch (error) {
      failed.push({ module: module.name, stage: 'register', message: messageOf(error) });
      continue;
    }
    try {
      target.absorb(scratch);
    } catch (error) {
      failed.push({ module: module.name, stage: 'conflict', message: messageOf(error) });
      continue;
    }
    loaded.push(module.name);
  }
  return { loaded, failed };
}

/** Discovers and registers every handler module of `dir`, logging each failure (never throwing). */
export async function loadHandlerModules(
  target: MockRouteCollector,
  options: { dir?: string; logger: MockLogger },
): Promise<RegistryResult> {
  const discovered = await discoverHandlerModules(options.dir ?? DEFAULT_HANDLERS_DIR);
  const registered = registerModules(target, discovered.modules);
  const failed = [...discovered.failed, ...registered.failed];
  for (const failure of failed) {
    options.logger.error('handler module skipped', { ...failure });
  }
  options.logger.info('handler modules loaded', { loaded: registered.loaded, failed: failed.length });
  return { loaded: registered.loaded, failed };
}
