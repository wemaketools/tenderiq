/**
 * People pickers (operations contract `people.ts`): operator staff for the operator screens and the active members of
 * the calling buyer for integration, exception and import ownership. Names and capacities only.
 */
import type { ActorRef } from '../../../contracts/common.js';
import { operationsEndpoints as api } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import { PERSONAS } from '../../fixtures/platform.js';
import { isOperatorUser } from './views.js';

/** Active members of a tenant with the capacity they act in, sorted by name. */
function activeMembersOf(tenantId: number): ActorRef[] {
  return PERSONAS.filter((persona) => persona.status === 'active')
    .flatMap((persona) =>
      persona.memberships
        .filter((membership) => membership.tenantId === tenantId && membership.status === 'active')
        .map((membership) => ({ userId: persona.userId, fullName: persona.fullName, capacity: membership.capacity })),
    )
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export function registerPeople(app: MockApp): void {
  mockRoute(app, api.listOperatorStaff, ({ requireTenant }) =>
    activeMembersOf(requireTenant().tenant.id).filter((person) => isOperatorUser(person.userId)),
  );

  mockRoute(app, api.listOperationsPeople, ({ requireTenant }) => activeMembersOf(requireTenant().tenant.id));
}
