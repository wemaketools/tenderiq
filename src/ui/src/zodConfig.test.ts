import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import './zodConfig';

describe('zodConfig', () => {
  it('switches Zod to jitless mode when imported, so parsing never probes new Function under the CSP', () => {
    // Arrange + Act: the import above applied the configuration.

    // Assert
    expect(z.config().jitless).toBe(true);
    expect(z.object({ a: z.string() }).parse({ a: 'x' })).toEqual({ a: 'x' });
  });
});
