/** Registry sample: a handler module in a directory (handlers/<name>/index.ts). */
import { z } from 'zod';

import { defineEndpoint } from '../../../../contracts/endpoint.js';
import { mockRoute } from '../../../middleware/routes.js';
import type { MockApp } from '../../../middleware/routes.js';

const directoryPing = defineEndpoint({
  id: 'sample.registry.directory',
  method: 'GET',
  path: '/api/v1/public/registry-sample/directory',
  audience: 'public',
  response: z.object({ from: z.literal('directory') }),
  errors: [],
  screens: ['PUB-01'],
});

export function register(app: MockApp): void {
  mockRoute(app, directoryPing, () => ({ from: 'directory' }));
}
