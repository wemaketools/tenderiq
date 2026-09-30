/** Registry sample: a well-formed handler module (registers one endpoint). */
import { z } from 'zod';

import { defineEndpoint } from '../../../contracts/endpoint.js';
import { mockRoute } from '../../middleware/routes.js';
import type { MockApp } from '../../middleware/routes.js';

export const samplePing = defineEndpoint({
  id: 'sample.registry.ping',
  method: 'GET',
  path: '/api/v1/public/registry-sample/ping',
  audience: 'public',
  response: z.object({ pong: z.literal(true) }),
  errors: [],
  screens: ['PUB-01'],
});

export function register(app: MockApp): void {
  mockRoute(app, samplePing, () => ({ pong: true }));
}
