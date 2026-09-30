/**
 * Buyer handlers: integration register and reconciliation (ADM-15, AC-33). Rows are filtered by the active buyer
 * tenant; another buyer's connection or exception is simply not found (BR-45). A caller holding `tender.publish`
 * without `org.integrations.manage` sees only publication and notice exceptions and those assigned to them
 * (PRD §4.2, §4.3); anything else is not found.
 */
import type { IntegrationConnectionsStatus } from '../../../contracts/enums.js';
import { TENDER_OWNER_EXCEPTION_RECORD_TYPES, operationsEndpoints as api } from '../../../contracts/operations.js';
import type { IntegrationDetail, IntegrationExceptionDetail, IntegrationExceptionRow, IntegrationRow } from '../../../contracts/operations.js';
import { mockRoute } from '../../app.js';
import type { MockApp } from '../../app.js';
import {
  INTEGRATION_CONFIRMATIONS,
  INTEGRATION_CONNECTIONS,
  INTEGRATION_EXCEPTION_HISTORY,
  OPERATIONS_INTEGRATION_EXCEPTIONS,
} from '../../fixtures/operations/index.js';
import type { FixtureIntegrationConnection, FixtureIntegrationExceptionRow } from '../../fixtures/operations/index.js';
import { personRef } from '../../persona.js';
import type { TenantAccess } from '../../persona.js';
import { activityView, isActiveMember, isoNow, matchesText, personOrNull, sortRows, withinDates } from './views.js';

const OPEN_EXCEPTION_STATUSES = ['open', 'investigating'] as const;

function isOpen(row: Pick<FixtureIntegrationExceptionRow, 'status'>): boolean {
  return (OPEN_EXCEPTION_STATUSES as readonly string[]).includes(row.status);
}

function connectionOf(id: number): FixtureIntegrationConnection {
  const connection = INTEGRATION_CONNECTIONS.find((row) => row.id === id);
  if (connection === undefined) {
    throw new Error(`Integration exception names unknown connection ${id}.`);
  }
  return connection;
}

function exceptionRow(row: FixtureIntegrationExceptionRow): IntegrationExceptionRow {
  const connection = connectionOf(row.connectionId);
  return {
    id: row.id,
    connectionId: row.connectionId,
    connectionName: connection.name,
    systemType: connection.systemType,
    recordType: row.recordType,
    recordId: row.recordId,
    recordLabel: row.recordLabel,
    recordLink: row.recordLink,
    description: row.description,
    status: row.status,
    owner: personOrNull(row.ownerUserId),
    openedAt: row.openedAt,
    resolvedAt: row.resolvedAt,
    resolution: row.resolution,
    unconfirmedEffect: row.unconfirmedEffect,
  };
}

function exceptionDetail(row: FixtureIntegrationExceptionRow, access: TenantAccess): IntegrationExceptionDetail {
  const open = isOpen(row);
  return {
    ...exceptionRow(row),
    history: INTEGRATION_EXCEPTION_HISTORY.filter((entry) => entry.exceptionId === row.id)
      .map(activityView)
      .sort((a, b) => a.at.localeCompare(b.at)),
    manualFallback: connectionOf(row.connectionId).manualFallback,
    capabilities: {
      canAssign: open && access.permissions.includes('org.integrations.manage'),
      canResolve: open,
    },
  };
}

function integrationRow(connection: FixtureIntegrationConnection): IntegrationRow {
  return {
    id: connection.id,
    systemType: connection.systemType,
    name: connection.name,
    businessOwner: personRef(connection.businessOwnerUserId),
    purpose: connection.purpose,
    status: connection.status,
    lastConfirmedAt: connection.lastConfirmedAt,
    openExceptions: OPERATIONS_INTEGRATION_EXCEPTIONS.filter((row) => row.connectionId === connection.id && isOpen(row)).length,
    hasManualFallback: connection.manualFallback !== null && connection.manualFallback.trim().length > 0,
  };
}

function integrationDetail(connection: FixtureIntegrationConnection): IntegrationDetail {
  return {
    ...integrationRow(connection),
    informationScope: connection.informationScope,
    recordOwnership: connection.recordOwnership,
    permittedRecipients: connection.permittedRecipients,
    expectedTimeliness: connection.expectedTimeliness,
    manualFallback: connection.manualFallback,
    contacts: connection.contacts.map((contact) => ({ ...contact })),
    confirmations: INTEGRATION_CONFIRMATIONS.filter((row) => row.connectionId === connection.id)
      .map((row) => ({ id: row.id, confirmedAt: row.confirmedAt, confirmedBy: personRef(row.confirmedByUserId), note: row.note }))
      .sort((a, b) => b.confirmedAt.localeCompare(a.confirmedAt)),
    recentExceptions: OPERATIONS_INTEGRATION_EXCEPTIONS.filter((row) => row.connectionId === connection.id)
      .map(exceptionRow)
      .sort((a, b) => b.openedAt.localeCompare(a.openedAt)),
    createdAt: connection.createdAt,
  };
}

/** Allowed connection status changes. */
const CONNECTION_TRANSITIONS: Readonly<Record<IntegrationConnectionsStatus, readonly IntegrationConnectionsStatus[]>> = {
  planned: ['active', 'retired'],
  active: ['suspended', 'retired'],
  suspended: ['active', 'retired'],
  retired: [],
};

/** Whether the caller may see an exception: every one with `org.integrations.manage`, else the tender-owner scope. */
function canSeeException(access: TenantAccess, userId: number, row: FixtureIntegrationExceptionRow): boolean {
  return (
    access.permissions.includes('org.integrations.manage') ||
    (TENDER_OWNER_EXCEPTION_RECORD_TYPES as readonly string[]).includes(row.recordType) ||
    row.ownerUserId === userId
  );
}

export function registerIntegrations(app: MockApp): void {
  function tenantConnection(tenantId: number, connectionId: number): FixtureIntegrationConnection | undefined {
    return INTEGRATION_CONNECTIONS.find((row) => row.id === connectionId && row.tenantId === tenantId);
  }

  function tenantException(access: TenantAccess, userId: number, exceptionId: number): FixtureIntegrationExceptionRow | undefined {
    return OPERATIONS_INTEGRATION_EXCEPTIONS.find(
      (row) => row.id === exceptionId && row.tenantId === access.tenant.id && canSeeException(access, userId, row),
    );
  }

  mockRoute(app, api.listIntegrations, ({ query, requireTenant, fixtures }) => {
    const { tenant } = requireTenant();
    const rows = INTEGRATION_CONNECTIONS.filter((row) => row.tenantId === tenant.id)
      .map(integrationRow)
      .filter((row) => query.systemType === undefined || query.systemType.includes(row.systemType))
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.businessOwnerUserId === undefined || row.businessOwner.userId === query.businessOwnerUserId)
      .filter((row) => query.hasOpenExceptions === undefined || (row.openExceptions > 0) === query.hasOpenExceptions)
      .filter((row) => matchesText(query.q, row.name, row.purpose, row.businessOwner.fullName));
    const sort = query.sort ?? 'name';
    const sorted = sortRows(rows, (row) => row[sort], query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getIntegration, ({ params, requireTenant, notFound }) => {
    const connection = tenantConnection(requireTenant().tenant.id, params.connectionId);
    if (connection === undefined) return notFound();
    return integrationDetail(connection);
  });

  mockRoute(app, api.createIntegration, ({ body, requireTenant, now, fail }) => {
    const { tenant } = requireTenant();
    if (!isActiveMember(body.businessOwnerUserId, tenant.id)) {
      fail(422, 'BUSINESS_OWNER_NOT_MEMBER', 'The business owner must be an active member of this organization.');
    }
    if (INTEGRATION_CONNECTIONS.some((row) => row.tenantId === tenant.id && row.name.toLowerCase() === body.name.toLowerCase())) {
      fail(409, 'INTEGRATION_NAME_TAKEN', 'A connection with this name already exists.');
    }
    return integrationDetail({
      id: 900,
      tenantId: tenant.id,
      systemType: body.systemType,
      name: body.name,
      businessOwnerUserId: body.businessOwnerUserId,
      purpose: body.purpose,
      informationScope: body.informationScope,
      recordOwnership: body.recordOwnership,
      permittedRecipients: null,
      expectedTimeliness: null,
      status: 'planned',
      lastConfirmedAt: null,
      manualFallback: body.manualFallback ?? null,
      contacts: [],
      createdAt: isoNow(now),
    });
  });

  mockRoute(app, api.updateIntegration, ({ params, body, requireTenant, notFound, fail }) => {
    const { tenant } = requireTenant();
    const connection = tenantConnection(tenant.id, params.connectionId);
    if (connection === undefined) return notFound();
    if (connection.status === 'retired') fail(409, 'INTEGRATION_RETIRED', 'A retired connection cannot be changed.');
    if (body.businessOwnerUserId !== undefined && !isActiveMember(body.businessOwnerUserId, tenant.id)) {
      fail(422, 'BUSINESS_OWNER_NOT_MEMBER', 'The business owner must be an active member of this organization.');
    }
    return integrationDetail({
      ...connection,
      name: body.name ?? connection.name,
      businessOwnerUserId: body.businessOwnerUserId ?? connection.businessOwnerUserId,
      purpose: body.purpose ?? connection.purpose,
      informationScope: body.informationScope ?? connection.informationScope,
      recordOwnership: body.recordOwnership ?? connection.recordOwnership,
      manualFallback: body.manualFallback ?? connection.manualFallback,
    });
  });

  mockRoute(app, api.changeIntegrationStatus, ({ params, body, requireTenant, notFound, fail }) => {
    const connection = tenantConnection(requireTenant().tenant.id, params.connectionId);
    if (connection === undefined) return notFound();
    if (!CONNECTION_TRANSITIONS[connection.status].includes(body.status)) {
      fail(409, 'INTEGRATION_TRANSITION_INVALID', `A ${connection.status} connection cannot become ${body.status}.`);
    }
    if (body.status === 'active' && (connection.manualFallback === null || connection.manualFallback.trim().length === 0)) {
      fail(409, 'MANUAL_FALLBACK_REQUIRED', 'Document the reviewed manual fallback before enabling the connection.');
    }
    if (body.status === 'retired' && OPERATIONS_INTEGRATION_EXCEPTIONS.some((row) => row.connectionId === connection.id && isOpen(row))) {
      fail(409, 'OPEN_EXCEPTIONS_BLOCK_RETIRE', 'Resolve the open exceptions of this connection before retiring it.');
    }
    return integrationDetail({ ...connection, status: body.status });
  });

  mockRoute(app, api.confirmIntegration, ({ params, body, requireTenant, requirePersona, now, notFound, fail }) => {
    const connection = tenantConnection(requireTenant().tenant.id, params.connectionId);
    if (connection === undefined) return notFound();
    if (connection.status !== 'active') fail(409, 'INTEGRATION_NOT_ACTIVE', 'Only an active connection can be confirmed.');
    const at = isoNow(now);
    const detail = integrationDetail({ ...connection, lastConfirmedAt: at });
    return {
      ...detail,
      confirmations: [{ id: 9000, confirmedAt: at, confirmedBy: personRef(requirePersona().userId), note: body.note ?? null }, ...detail.confirmations],
    };
  });

  // ---------------------------------------------------------------------------------------------------
  // Exceptions
  // ---------------------------------------------------------------------------------------------------
  mockRoute(app, api.listIntegrationExceptions, ({ query, requireTenant, requirePersona, fixtures }) => {
    const access = requireTenant();
    const userId = requirePersona().userId;
    const rows = OPERATIONS_INTEGRATION_EXCEPTIONS.filter((row) => row.tenantId === access.tenant.id && canSeeException(access, userId, row))
      .map(exceptionRow)
      .filter((row) => query.status === undefined || query.status.includes(row.status))
      .filter((row) => query.connectionId === undefined || row.connectionId === query.connectionId)
      .filter((row) => query.recordType === undefined || query.recordType.includes(row.recordType))
      .filter((row) => query.ownerUserId === undefined || row.owner?.userId === query.ownerUserId)
      .filter((row) => withinDates(row.openedAt, query.openedFrom, query.openedTo))
      .filter((row) => matchesText(query.q, row.recordLabel, row.description, row.connectionName));
    const sort = query.sort ?? 'openedAt';
    const sorted = sortRows(rows, (row) => row[sort], query.sort === undefined ? 'desc' : query.dir);
    return fixtures.page(sorted);
  });

  mockRoute(app, api.getIntegrationException, ({ params, requireTenant, requirePersona, notFound }) => {
    const access = requireTenant();
    const row = tenantException(access, requirePersona().userId, params.exceptionId);
    if (row === undefined) return notFound();
    return exceptionDetail(row, access);
  });

  mockRoute(app, api.assignIntegrationException, ({ params, body, requireTenant, requirePersona, notFound, fail }) => {
    const access = requireTenant();
    const row = tenantException(access, requirePersona().userId, params.exceptionId);
    if (row === undefined) return notFound();
    if (!isOpen(row)) fail(409, 'EXCEPTION_ALREADY_RESOLVED', 'This exception is already resolved.');
    if (!isActiveMember(body.ownerUserId, access.tenant.id)) fail(422, 'OWNER_NOT_MEMBER', 'The owner must be an active member of this organization.');
    return exceptionDetail({ ...row, ownerUserId: body.ownerUserId }, access);
  });

  mockRoute(app, api.investigateIntegrationException, ({ params, requireTenant, requirePersona, notFound, fail }) => {
    const access = requireTenant();
    const row = tenantException(access, requirePersona().userId, params.exceptionId);
    if (row === undefined) return notFound();
    if (!isOpen(row)) fail(409, 'EXCEPTION_ALREADY_RESOLVED', 'This exception is already resolved.');
    if (row.status === 'investigating') fail(409, 'EXCEPTION_ALREADY_INVESTIGATING', 'This exception is already being investigated.');
    return exceptionDetail({ ...row, status: 'investigating' }, access);
  });

  mockRoute(app, api.resolveIntegrationException, ({ params, body, requireTenant, requirePersona, now, notFound, fail }) => {
    const access = requireTenant();
    const row = tenantException(access, requirePersona().userId, params.exceptionId);
    if (row === undefined) return notFound();
    if (!isOpen(row)) fail(409, 'EXCEPTION_ALREADY_RESOLVED', 'This exception is already resolved.');
    if (body.outcome === 'reconciled' && row.recordType === 'publication' && (body.externalReference ?? '').length === 0) {
      fail(
        422,
        'EXTERNAL_CONFIRMATION_REQUIRED',
        'Enter the external publication reference. The tender stays unconfirmed until the external notice is confirmed and reconciled.',
      );
    }
    const fallback = connectionOf(row.connectionId).manualFallback;
    if (body.outcome === 'manual_fallback_used' && (fallback === null || fallback.trim().length === 0)) {
      fail(409, 'MANUAL_FALLBACK_NOT_DOCUMENTED', 'This connection has no documented manual fallback.');
    }
    const reference = body.externalReference === undefined || body.externalReference.length === 0 ? '' : ` External reference ${body.externalReference}.`;
    return exceptionDetail(
      { ...row, status: body.outcome, resolvedAt: isoNow(now), resolution: `${body.resolution}${reference}`, unconfirmedEffect: null },
      access,
    );
  });
}
