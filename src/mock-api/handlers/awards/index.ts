/**
 * Mock handlers of the awards contract (`src/contracts/awards.ts`; domain 13): buyer award file, recommendations,
 * notices, standstill, public notice, debriefs, complaints and closeout; supplier outcomes and complaints; public
 * awards. Static fixtures only (src/mock-api/fixtures/awards); commands return their outcome and persist nothing.
 */
import type { MockApp } from '../../app.js';
import { registerBuyerAwardRoutes } from './buyer-awards.js';
import { registerBuyerCaseRoutes } from './buyer-cases.js';
import { registerPublicRoutes } from './public.js';
import { registerSupplierRoutes } from './supplier.js';

export function register(app: MockApp): void {
  registerBuyerAwardRoutes(app);
  registerBuyerCaseRoutes(app);
  registerSupplierRoutes(app);
  registerPublicRoutes(app);
}
