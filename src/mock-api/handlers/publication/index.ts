/**
 * Mock handlers of the publication domain (domain 07): the public portal, buyer publication and participants,
 * and the supplier opportunity screens. Auto-discovered by `registry.ts`.
 */
import type { MockApp } from '../../app.js';
import { registerBuyer } from './buyer.js';
import { registerPublic } from './public.js';
import { registerSupplier } from './supplier.js';

export function register(app: MockApp): void {
  registerPublic(app);
  registerBuyer(app);
  registerSupplier(app);
}
