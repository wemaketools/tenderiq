/**
 * Handler registration (architecture-plan §3.11, §4 "Registries").
 *
 * The mock API mounts every handler module of `src/mock-api/handlers` (`*.ts` and `<name>/index.ts`), listed in a
 * stable alphabetical order by `handler-modules.ts` so the same registry runs in the browser prototype (DD-50).
 * `registry-discovery.ts` finds the modules on disk for tests. Each module exports `register(app: MockApp)` and
 * calls `mockRoute(app, endpoint, handler)` for its endpoints.
 *
 * Every module is loaded IN ISOLATION: it registers into its own collector, which is merged only when the whole
 * registration succeeded. A module that fails to import, exports no `register`, throws while registering, or
 * claims a method + path (or endpoint id) another module already registered is logged and skipped; the server
 * keeps running with the others.
 *
 * `src/server` and `api/` never import the mock API; in Stage A the SPA reaches it only through its prototype transport
 * (DD-50, lint rules).
 */
import { MockRouteCollector } from './middleware/routes.js';
import type { MockApp } from './middleware/routes.js';

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
