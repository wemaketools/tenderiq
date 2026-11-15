import { describe, expect, it } from 'vitest';

import { HANDLER_MODULES } from './handler-modules.js';
import { discoverHandlerModules } from './registry-discovery.js';

describe('HANDLER_MODULES', () => {
  it('lists exactly the handler modules on disk, in discovery order', async () => {
    // Arrange
    const discovered = await discoverHandlerModules();

    // Assert
    expect(discovered.failed).toEqual([]);
    expect(HANDLER_MODULES.map((module) => module.name)).toEqual(discovered.modules.map((module) => module.name));
  });

  it('binds each name to the register function of that module', async () => {
    // Arrange
    const discovered = await discoverHandlerModules();
    const byName = new Map(discovered.modules.map((module) => [module.name, module.register]));

    // Assert
    for (const module of HANDLER_MODULES) {
      expect(module.register, module.name).toBe(byName.get(module.name));
    }
  });
});
