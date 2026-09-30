/**
 * Audit client (the `audit` contract): the history of one record in the active buyer organization. Restricted
 * rows arrive as metadata only (DD-31).
 */
import { getEntityHistory } from '@contracts/audit';
import type { AuditPage } from '@contracts/audit';
import type { EndpointQuery } from '@contracts/endpoint';

import { call } from './client';

/** GET /api/v1/buyer/audit/entities/:entityType/:entityId. */
export function fetchEntityHistory(
  entityType: string,
  entityId: number,
  query: EndpointQuery<typeof getEntityHistory> = {},
): Promise<AuditPage> {
  return call(getEntityHistory, { params: { entityType, entityId }, query });
}
