/**
 * People pickers of the operations screens: the operator staff who can own customers, cases and incidents (OPS-01,
 * OPS-04, OPS-05) and the buyer members who can own integrations, exceptions and imports (ADM-15, ADM-16). Names and
 * capacities only: never contact details or access rights.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { ActorRef } from '../common.js';
import { defineEndpoint } from '../endpoint.js';

/** Active operator staff (members of the operator tenant). */
export const listOperatorStaff = defineEndpoint({
  id: 'ops.operations.staff.list',
  method: 'GET',
  path: '/api/v1/ops/staff',
  audience: 'ops',
  permission: [
    'ops.customers.manage',
    'ops.subscriptions.manage',
    'ops.support.manage',
    'ops.incidents.manage',
    'ops.content.manage',
    'ops.oversight.view',
  ],
  response: z.array(ActorRef),
  errors: [],
  screens: ['OPS-01', 'OPS-02', 'OPS-04', 'OPS-05'],
  summary: 'Operator staff who may be named service owner, case assignee or plan owner.',
});

/** Active members of the buyer who may own an integration, an exception or an import review. */
export const listOperationsPeople = defineEndpoint({
  id: 'buyer.operations.people.list',
  method: 'GET',
  path: '/api/v1/buyer/operations-people',
  audience: 'buyer',
  permission: ['org.integrations.manage', 'org.imports.manage', 'tender.publish'],
  response: z.array(ActorRef),
  errors: [],
  screens: ['ADM-15', 'ADM-16'],
  summary: 'Active members of the organization who may own an integration, exception or import review.',
});

export const peopleRoutes = {
  listOperatorStaff,
  listOperationsPeople,
} as const;
