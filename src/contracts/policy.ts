/**
 * Policy contract (domain 02): procurement policy profiles (ADM-06), forms and business fields (ADM-07), the
 * template and content library (ADM-08) and the public portal and publication policy (ADM-11). FR-22, PRD §17,
 * §18.1, BR-09; supports AC-06 (release approval and material-change rules are part of the adopted policy version).
 *
 * The schemas live in `./policy/*.ts`; this module re-exports them and publishes the one endpoint map
 * `policyEndpoints` (foundation-contract §1).
 */
import { customFieldRoutes } from './policy/fields.js';
import { portalRoutes } from './policy/portal.js';
import { policyProfileRoutes } from './policy/profiles.js';
import { templateRoutes } from './policy/templates.js';

export * from './policy/shared.js';
export * from './policy/profiles.js';
export * from './policy/fields.js';
export * from './policy/templates.js';
export * from './policy/portal.js';

/** Every endpoint of the policy domain. */
export const policyEndpoints = {
  ...policyProfileRoutes,
  ...customFieldRoutes,
  ...templateRoutes,
  ...portalRoutes,
} as const;
