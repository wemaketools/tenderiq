/** Registry sample: registers one route, then throws; the whole module must be dropped. */
import { z } from 'zod';

import { defineEndpoint } from '../../../contracts/endpoint.js';
import { mockRoute } from '../../middleware/routes.js';
import type { MockApp } from '../../middleware/routes.js';

const partial = defineEndpoint({
  id: 'sample.registry.partial',
  method: 'GET',
  path: '/api/v1/public/registry-sample/partial',
  audience: 'public',
  response: z.object({ ok: z.boolean() }),
  errors: [],
  screens: ['PUB-01'],
});

export function register(app: MockApp): void {
  mockRoute(app, partial, () => ({ ok: true }));
  throw new Error('registry sample: register failure');
}
