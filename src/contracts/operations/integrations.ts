/**
 * Buyer integration register and reconciliation (ADM-15; PRD §16; AC-33). Blueprint: `integration_connections`,
 * `integration_exceptions` [T].
 *
 * Rules the contract carries (Stage B enforces them):
 * - Every connection names its business owner, purpose, information scope and a reviewed manual fallback; a
 *   connection is enabled only with a documented fallback (`MANUAL_FALLBACK_REQUIRED`, PRD §16).
 * - A failed transfer stays visible until resolved and never silently marks an external publication, signature or
 *   payment as completed (AC-33). Reconciling an external publication requires the external confirmation reference
 *   (`EXTERNAL_CONFIRMATION_REQUIRED`); the tender stays "not advertised externally" until then.
 * - A connection with open exceptions cannot be retired (`OPEN_EXCEPTIONS_BLOCK_RETIRE`).
 * - The tender owner resolves failed publications: exception reads, investigation and resolution accept
 *   `tender.publish` as well as `org.integrations.manage`, but a caller without `org.integrations.manage` is scoped
 *   to publication and notice exceptions (`TENDER_OWNER_EXCEPTION_RECORD_TYPES`) and exceptions assigned to them.
 *   Contract, membership, supplier and export exceptions carry financial and HR information (PRD §4.3) and are not
 *   found (404) for that caller.
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import {
  CalendarDate,
  Id,
  IdParam,
  Instant,
  LinkPath,
  PersonRef,
  QueryBoolean,
  ReasonText,
  listQueryWithSort,
  pageOf,
  queryList,
} from '../common.js';
import { defineEndpoint } from '../endpoint.js';
import {
  INTEGRATION_CONNECTIONS_STATUS,
  INTEGRATION_CONNECTIONS_SYSTEM_TYPE,
  IntegrationConnectionsStatus,
  IntegrationConnectionsSystemType,
  IntegrationExceptionsStatus,
} from '../enums.js';
import { ActivityEntry, ExceptionResolution, IntegrationRecordType, NoteText, bodyText, choice, optionalText, titleText } from './shared.js';

// ---------------------------------------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------------------------------------

/** One integration exception (`integration_exceptions`). */
export const IntegrationExceptionRow = z.object({
  id: Id,
  connectionId: Id,
  connectionName: z.string().min(1),
  systemType: IntegrationConnectionsSystemType,
  recordType: IntegrationRecordType,
  recordId: Id,
  /** A readable label of the affected record ("T-2026-0002 version 2, external notice"). */
  recordLabel: z.string().min(1),
  recordLink: LinkPath.nullable(),
  description: z.string().min(1),
  status: IntegrationExceptionsStatus,
  owner: PersonRef.nullable(),
  openedAt: Instant,
  resolvedAt: Instant.nullable(),
  resolution: z.string().nullable(),
  /** What remains unconfirmed while the exception is open (AC-33). */
  unconfirmedEffect: z.string().nullable(),
});
export type IntegrationExceptionRow = z.infer<typeof IntegrationExceptionRow>;

/** One row of the integration register. */
export const IntegrationRow = z.object({
  id: Id,
  systemType: IntegrationConnectionsSystemType,
  name: z.string().min(1),
  businessOwner: PersonRef,
  purpose: z.string().min(1),
  status: IntegrationConnectionsStatus,
  lastConfirmedAt: Instant.nullable(),
  openExceptions: z.number().int().min(0),
  hasManualFallback: z.boolean(),
});
export type IntegrationRow = z.infer<typeof IntegrationRow>;

export const INTEGRATION_SORT_FIELDS = ['name', 'systemType', 'status', 'lastConfirmedAt', 'openExceptions'] as const;
export const IntegrationListQuery = listQueryWithSort(INTEGRATION_SORT_FIELDS).extend({
  systemType: queryList(IntegrationConnectionsSystemType).optional(),
  status: queryList(IntegrationConnectionsStatus).optional(),
  businessOwnerUserId: IdParam.optional(),
  hasOpenExceptions: QueryBoolean.optional(),
});
export type IntegrationListQuery = z.input<typeof IntegrationListQuery>;

/** A confirmation that the exchange still agrees with the official records. */
export const IntegrationConfirmation = z.object({
  id: Id,
  confirmedAt: Instant,
  confirmedBy: PersonRef,
  note: z.string().nullable(),
});
export type IntegrationConfirmation = z.infer<typeof IntegrationConfirmation>;

/** A responsible contact of a connection. */
export const IntegrationContact = z.object({
  role: z.string().min(1),
  name: z.string().min(1),
  email: z.string().nullable(),
});
export type IntegrationContact = z.infer<typeof IntegrationContact>;

/** The connection detail (ADM-15 required information). */
export const IntegrationDetail = IntegrationRow.extend({
  informationScope: z.string().min(1),
  /** Which side owns each exchanged record ("KWU owns commitments; finance owns balances"). */
  recordOwnership: z.string().min(1),
  permittedRecipients: z.string().nullable(),
  expectedTimeliness: z.string().nullable(),
  manualFallback: z.string().nullable(),
  contacts: z.array(IntegrationContact),
  confirmations: z.array(IntegrationConfirmation),
  recentExceptions: z.array(IntegrationExceptionRow),
  createdAt: Instant,
});
export type IntegrationDetail = z.infer<typeof IntegrationDetail>;

export const IntegrationParams = z.object({ connectionId: IdParam });

const ScopeText = bodyText('INFORMATION_SCOPE_REQUIRED', 4000);

export const CreateIntegrationBody = z.object({
  systemType: choice(INTEGRATION_CONNECTIONS_SYSTEM_TYPE, 'INVALID_SYSTEM_TYPE', 'Choose the kind of external system.'),
  name: titleText('NAME_REQUIRED', 120),
  businessOwnerUserId: Id,
  purpose: bodyText('PURPOSE_REQUIRED', 2000),
  informationScope: ScopeText,
  recordOwnership: bodyText('RECORD_OWNERSHIP_REQUIRED', 2000),
  manualFallback: NoteText.optional(),
});
export type CreateIntegrationBody = z.infer<typeof CreateIntegrationBody>;

export const UpdateIntegrationBody = z.object({
  name: titleText('NAME_REQUIRED', 120).optional(),
  businessOwnerUserId: Id.optional(),
  purpose: bodyText('PURPOSE_REQUIRED', 2000).optional(),
  informationScope: ScopeText.optional(),
  recordOwnership: bodyText('RECORD_OWNERSHIP_REQUIRED', 2000).optional(),
  manualFallback: NoteText.optional(),
});
export type UpdateIntegrationBody = z.infer<typeof UpdateIntegrationBody>;

export const ChangeIntegrationStatusBody = z.object({
  status: choice(INTEGRATION_CONNECTIONS_STATUS, 'INVALID_STATUS', 'Choose planned, active, suspended or retired.'),
  reason: ReasonText,
});
export type ChangeIntegrationStatusBody = z.infer<typeof ChangeIntegrationStatusBody>;

export const ConfirmIntegrationBody = z.object({
  note: NoteText.optional(),
});
export type ConfirmIntegrationBody = z.infer<typeof ConfirmIntegrationBody>;

// ---------------------------------------------------------------------------------------------------------
// Exceptions
// ---------------------------------------------------------------------------------------------------------

export const EXCEPTION_SORT_FIELDS = ['openedAt', 'status', 'connectionName', 'resolvedAt'] as const;
export const IntegrationExceptionListQuery = listQueryWithSort(EXCEPTION_SORT_FIELDS).extend({
  status: queryList(IntegrationExceptionsStatus).optional(),
  connectionId: IdParam.optional(),
  recordType: queryList(IntegrationRecordType).optional(),
  ownerUserId: IdParam.optional(),
  openedFrom: CalendarDate.optional(),
  openedTo: CalendarDate.optional(),
});
export type IntegrationExceptionListQuery = z.input<typeof IntegrationExceptionListQuery>;

export const IntegrationExceptionDetail = IntegrationExceptionRow.extend({
  history: z.array(ActivityEntry),
  manualFallback: z.string().nullable(),
  /** What the current user may do. */
  capabilities: z.object({ canAssign: z.boolean(), canResolve: z.boolean() }),
});
export type IntegrationExceptionDetail = z.infer<typeof IntegrationExceptionDetail>;

export const IntegrationExceptionParams = z.object({ exceptionId: IdParam });

export const AssignExceptionBody = z.object({ ownerUserId: Id });
export type AssignExceptionBody = z.infer<typeof AssignExceptionBody>;

export const InvestigateExceptionBody = z.object({ note: NoteText.optional() });
export type InvestigateExceptionBody = z.infer<typeof InvestigateExceptionBody>;

export const ResolveExceptionBody = z.object({
  outcome: ExceptionResolution,
  resolution: ReasonText,
  /** The external confirmation reference (required to reconcile an external publication). */
  externalReference: optionalText(80).optional(),
});
export type ResolveExceptionBody = z.infer<typeof ResolveExceptionBody>;

// ---------------------------------------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------------------------------------

const EXCEPTION_ACCESS = ['org.integrations.manage', 'tender.publish'] as const;

/**
 * Record types a caller holding only `tender.publish` sees in the exception queue (AC-33: the tender owner
 * reconciles failed external publications). Every other exception is visible to `org.integrations.manage`
 * holders, or to the person it is assigned to.
 */
export const TENDER_OWNER_EXCEPTION_RECORD_TYPES = ['publication', 'notice'] as const satisfies readonly IntegrationRecordType[];

const EXCEPTION_SCOPE_NOTE =
  'Holders of org.integrations.manage see every exception of the organization. Holders of tender.publish only see publication and notice exceptions and exceptions assigned to them; any other exception is not found (404).';

export const listIntegrations = defineEndpoint({
  id: 'buyer.operations.integrations.list',
  method: 'GET',
  path: '/api/v1/buyer/integrations',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  query: IntegrationListQuery,
  response: pageOf(IntegrationRow),
  errors: [],
  screens: ['ADM-15'],
});

export const getIntegration = defineEndpoint({
  id: 'buyer.operations.integrations.get',
  method: 'GET',
  path: '/api/v1/buyer/integrations/:connectionId',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  params: IntegrationParams,
  response: IntegrationDetail,
  errors: [],
  screens: ['ADM-15'],
});

export const createIntegration = defineEndpoint({
  id: 'buyer.operations.integrations.create',
  method: 'POST',
  path: '/api/v1/buyer/integrations',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  body: CreateIntegrationBody,
  response: IntegrationDetail,
  idempotent: true,
  errors: ['BUSINESS_OWNER_NOT_MEMBER', 'INTEGRATION_NAME_TAKEN'],
  screens: ['ADM-15'],
});

export const updateIntegration = defineEndpoint({
  id: 'buyer.operations.integrations.update',
  method: 'PATCH',
  path: '/api/v1/buyer/integrations/:connectionId',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  params: IntegrationParams,
  body: UpdateIntegrationBody,
  response: IntegrationDetail,
  errors: ['BUSINESS_OWNER_NOT_MEMBER', 'INTEGRATION_RETIRED'],
  screens: ['ADM-15'],
});

export const changeIntegrationStatus = defineEndpoint({
  id: 'buyer.operations.integrations.changeStatus',
  method: 'POST',
  path: '/api/v1/buyer/integrations/:connectionId/status',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  params: IntegrationParams,
  body: ChangeIntegrationStatusBody,
  response: IntegrationDetail,
  errors: ['INTEGRATION_TRANSITION_INVALID', 'MANUAL_FALLBACK_REQUIRED', 'OPEN_EXCEPTIONS_BLOCK_RETIRE'],
  screens: ['ADM-15'],
});

export const confirmIntegration = defineEndpoint({
  id: 'buyer.operations.integrations.confirm',
  method: 'POST',
  path: '/api/v1/buyer/integrations/:connectionId/confirm',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  params: IntegrationParams,
  body: ConfirmIntegrationBody,
  response: IntegrationDetail,
  errors: ['INTEGRATION_NOT_ACTIVE'],
  screens: ['ADM-15'],
});

export const listIntegrationExceptions = defineEndpoint({
  id: 'buyer.operations.integrationExceptions.list',
  summary: `List integration exceptions. ${EXCEPTION_SCOPE_NOTE}`,
  method: 'GET',
  path: '/api/v1/buyer/integration-exceptions',
  audience: 'buyer',
  permission: EXCEPTION_ACCESS,
  query: IntegrationExceptionListQuery,
  response: pageOf(IntegrationExceptionRow),
  errors: [],
  screens: ['ADM-15'],
});

export const getIntegrationException = defineEndpoint({
  id: 'buyer.operations.integrationExceptions.get',
  summary: `Read an integration exception. ${EXCEPTION_SCOPE_NOTE}`,
  method: 'GET',
  path: '/api/v1/buyer/integration-exceptions/:exceptionId',
  audience: 'buyer',
  permission: EXCEPTION_ACCESS,
  params: IntegrationExceptionParams,
  response: IntegrationExceptionDetail,
  errors: [],
  screens: ['ADM-15'],
});

export const assignIntegrationException = defineEndpoint({
  id: 'buyer.operations.integrationExceptions.assign',
  method: 'POST',
  path: '/api/v1/buyer/integration-exceptions/:exceptionId/assign',
  audience: 'buyer',
  permission: 'org.integrations.manage',
  params: IntegrationExceptionParams,
  body: AssignExceptionBody,
  response: IntegrationExceptionDetail,
  errors: ['EXCEPTION_ALREADY_RESOLVED', 'OWNER_NOT_MEMBER'],
  screens: ['ADM-15'],
});

export const investigateIntegrationException = defineEndpoint({
  id: 'buyer.operations.integrationExceptions.investigate',
  summary: `Mark an integration exception as under investigation. ${EXCEPTION_SCOPE_NOTE}`,
  method: 'POST',
  path: '/api/v1/buyer/integration-exceptions/:exceptionId/investigate',
  audience: 'buyer',
  permission: EXCEPTION_ACCESS,
  params: IntegrationExceptionParams,
  body: InvestigateExceptionBody,
  response: IntegrationExceptionDetail,
  errors: ['EXCEPTION_ALREADY_RESOLVED', 'EXCEPTION_ALREADY_INVESTIGATING'],
  screens: ['ADM-15'],
});

export const resolveIntegrationException = defineEndpoint({
  id: 'buyer.operations.integrationExceptions.resolve',
  summary: `Resolve an integration exception (reconciled, manual fallback used, or closed). ${EXCEPTION_SCOPE_NOTE}`,
  method: 'POST',
  path: '/api/v1/buyer/integration-exceptions/:exceptionId/resolve',
  audience: 'buyer',
  permission: EXCEPTION_ACCESS,
  params: IntegrationExceptionParams,
  body: ResolveExceptionBody,
  response: IntegrationExceptionDetail,
  errors: ['EXCEPTION_ALREADY_RESOLVED', 'EXTERNAL_CONFIRMATION_REQUIRED', 'MANUAL_FALLBACK_NOT_DOCUMENTED'],
  screens: ['ADM-15'],
});

export const integrationRoutes = {
  listIntegrations,
  getIntegration,
  createIntegration,
  updateIntegration,
  changeIntegrationStatus,
  confirmIntegration,
  listIntegrationExceptions,
  getIntegrationException,
  assignIntegrationException,
  investigateIntegrationException,
  resolveIntegrationException,
} as const;
