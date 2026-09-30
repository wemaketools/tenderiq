/** Registry sample: claims the route a-good already registered; it must be rejected as a conflict. */
import { z } from 'zod';

import { defineEndpoint } from '../../../contracts/endpoint.js';
import { mockRoute } from '../../middleware/routes.js';
import type { MockApp } from '../../middleware/routes.js';

const duplicate = defineEndpoint({
  id: 'sample.registry.duplicate',
  method: 'GET',
  path: '/api/v1/public/registry-sample/ping',
  audience: 'public',
  response: z.object({ pong: z.literal(true) }),
  errors: [],
  screens: ['PUB-01'],
});

export function register(app: MockApp): void {
  mockRoute(app, duplicate, () => ({ pong: true }));
}
