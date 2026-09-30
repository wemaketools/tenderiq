/**
 * Operations fixtures: the buyer integration register and its exceptions (ADM-15, PRD §16, AC-33).
 *
 * Storyline anchors:
 * - AC-33: the external publication of T-2026-0002 version 2 failed at the Gazette gateway. Its exception (901) is
 *   the publication domain's `INTEGRATION_EXCEPTIONS` row, reused here with the same id, owner and status, so the
 *   tender stays visibly "not advertised externally" until the exception is reconciled.
 * - Exception 902 (late Gazette confirmation for T-2026-0001, reconciled) also comes from the publication fixture.
 * - KWU also has an investigating finance exception on C-2026-0001, a closed e-signature exception on C-2026-0002
 *   and a reconciled directory exception for the departed officer (AC-04). ODC's Gazette confirmation for
 *   T-2026-0011 is overdue (the publication fixture shows it `awaiting_confirmation`).
 */
import type { IntegrationConnectionsStatus, IntegrationConnectionsSystemType, IntegrationExceptionsStatus } from '../../../contracts/enums.js';
import type { IntegrationRecordType } from '../../../contracts/operations.js';
import { TENANT_IDS } from '../platform.js';
import { EXTERNAL_CHANNEL_NAME, INTEGRATION_EXCEPTIONS as PUBLICATION_EXCEPTIONS } from '../publication.js';
import { OPS_USERS } from './customers.js';

export interface FixtureIntegrationContact {
  readonly role: string;
  readonly name: string;
  readonly email: string | null;
}

export interface FixtureIntegrationConnection {
  readonly id: number;
  readonly tenantId: number;
  readonly systemType: IntegrationConnectionsSystemType;
  readonly name: string;
  readonly businessOwnerUserId: number;
  readonly purpose: string;
  readonly informationScope: string;
  readonly recordOwnership: string;
  readonly permittedRecipients: string | null;
  readonly expectedTimeliness: string | null;
  readonly status: IntegrationConnectionsStatus;
  readonly lastConfirmedAt: string | null;
  readonly manualFallback: string | null;
  readonly contacts: readonly FixtureIntegrationContact[];
  readonly createdAt: string;
}

const KWU = TENANT_IDS.kwu;
const ODC = TENANT_IDS.odc;

export const INTEGRATION_CONNECTIONS: readonly FixtureIntegrationConnection[] = Object.freeze([
  {
    id: 1,
    tenantId: KWU,
    systemType: 'notice_portal',
    name: EXTERNAL_CHANNEL_NAME,
    businessOwnerUserId: OPS_USERS.mphoManager,
    purpose: 'Publish opportunities, addenda, cancellations and award notices in the Government Gazette and receive publication confirmations.',
    informationScope: 'Public notice text and released attachments of each published tender version. No internal budgets or bidder information.',
    recordOwnership: 'KWU owns the official notice versions in TenderIQ; the Gazette owns its publication reference and date.',
    permittedRecipients: 'Government Gazette e-Notices gateway (public).',
    expectedTimeliness: 'Confirmation within 24 hours of each publication.',
    status: 'active',
    lastConfirmedAt: '2026-09-02T09:15:00Z',
    manualFallback:
      'The procurement office lodges the notice with the Gazette clerk in person and scans the stamped receipt into the tender record. The tender counts as advertised externally only after the receipt is reconciled.',
    contacts: [
      { role: 'Business owner', name: 'Mpho Dikgang', email: 'mpho.manager@tenderiq.local' },
      { role: 'Exception owner', name: 'Tebogo Molefe', email: 'tebogo.officer@tenderiq.local' },
      { role: 'Gazette service desk', name: 'Government Gazette e-Notices', email: null },
    ],
    createdAt: '2026-01-20T08:00:00Z',
  },
  {
    id: 2,
    tenantId: KWU,
    systemType: 'esignature',
    name: 'Accredited e-signature service',
    businessOwnerUserId: OPS_USERS.masegoContracts,
    purpose: 'Issue approved contract versions for signature and receive signing progress and the signed agreement.',
    informationScope: 'The approved contract version, signatory names and authority references.',
    recordOwnership: 'TenderIQ owns the approved version; the signature service owns the signing evidence.',
    permittedRecipients: 'Named signatories of KWU and the awarded supplier.',
    expectedTimeliness: 'Status updates within 15 minutes of each signing event.',
    status: 'active',
    lastConfirmedAt: '2026-09-24T10:30:00Z',
    manualFallback: 'Wet-ink signing recorded as "signed outside the app" with the executed edition, signatories, dates and verification.',
    contacts: [
      { role: 'Business owner', name: 'Masego Rakgosi', email: 'masego.contracts@tenderiq.local' },
      { role: 'Legal reviewer', name: 'Dineo Masire', email: 'dineo.legal@tenderiq.local' },
    ],
    createdAt: '2026-02-16T08:00:00Z',
  },
  {
    id: 3,
    tenantId: KWU,
    systemType: 'finance',
    name: 'KWU financial management system',
    businessOwnerUserId: OPS_USERS.lesegoFinance,
    purpose: 'Obtain cost centres and available budget; send approved commitments for awards and contract changes.',
    informationScope: 'Cost centres, budget lines, available amounts and approved commitments (amount, currency, contract reference).',
    recordOwnership: 'Finance owns official balances; TenderIQ owns the approved commitment decisions.',
    permittedRecipients: 'KWU finance department.',
    expectedTimeliness: 'Balances refreshed every hour; commitments acknowledged within one working day.',
    status: 'active',
    lastConfirmedAt: '2026-09-18T07:00:00Z',
    manualFallback: 'The financial reviewer records the funding disposition from a signed finance confirmation and uploads it to the request.',
    contacts: [
      { role: 'Business owner', name: 'Lesego Seretse', email: 'lesego.finance@tenderiq.local' },
      { role: 'Budget owner (Operations)', name: 'Onalenna Tau', email: 'onalenna.budget@tenderiq.local' },
    ],
    createdAt: '2026-08-04T08:00:00Z',
  },
  {
    id: 4,
    tenantId: KWU,
    systemType: 'directory',
    name: 'KWU staff directory',
    businessOwnerUserId: OPS_USERS.adminKwu,
    purpose: 'Confirm employee identity, contact details and employment status for buyer memberships.',
    informationScope: 'Name, work e-mail, department and employment status of KWU staff.',
    recordOwnership: 'The HR directory owns employment status; TenderIQ owns roles, delegations and authority.',
    permittedRecipients: 'TenderIQ membership administration only.',
    expectedTimeliness: 'Daily at 05:00.',
    status: 'active',
    lastConfirmedAt: '2026-09-30T05:00:00Z',
    manualFallback: 'HR notifies the organization administrator by e-mail of each leaver; the administrator deactivates the membership.',
    contacts: [{ role: 'Business owner', name: 'Lorato Kgosi', email: 'admin.kwu@tenderiq.local' }],
    createdAt: '2026-01-25T08:00:00Z',
  },
  {
    id: 5,
    tenantId: KWU,
    systemType: 'vendor_master',
    name: 'KWU vendor master',
    businessOwnerUserId: OPS_USERS.lesegoFinance,
    purpose: 'Reconcile legal supplier identity, bank status and business identifiers with the accounts payable vendor master.',
    informationScope: 'Supplier legal name, registration number, tax identifier and vendor status.',
    recordOwnership: 'Accounts payable owns vendor status; a vendor status never equals tender qualification.',
    permittedRecipients: 'KWU accounts payable.',
    expectedTimeliness: null,
    status: 'planned',
    lastConfirmedAt: null,
    manualFallback: null,
    contacts: [{ role: 'Business owner', name: 'Lesego Seretse', email: 'lesego.finance@tenderiq.local' }],
    createdAt: '2026-09-10T08:00:00Z',
  },
  {
    id: 6,
    tenantId: KWU,
    systemType: 'registry',
    name: 'Companies registry lookup',
    businessOwnerUserId: OPS_USERS.mphoManager,
    purpose: 'Verify business standing and registration of suppliers during qualification.',
    informationScope: 'Registration number, status and registered directors of suppliers under review.',
    recordOwnership: 'The registry owns registration data; assessors record their own conclusion.',
    permittedRecipients: 'Qualification assessors.',
    expectedTimeliness: 'On request.',
    status: 'suspended',
    lastConfirmedAt: '2026-06-30T09:00:00Z',
    manualFallback: 'Assessors attach a dated registry extract obtained from the registry counter.',
    contacts: [{ role: 'Business owner', name: 'Mpho Dikgang', email: 'mpho.manager@tenderiq.local' }],
    createdAt: '2026-03-02T08:00:00Z',
  },
  {
    id: 11,
    tenantId: ODC,
    systemType: 'notice_portal',
    name: EXTERNAL_CHANNEL_NAME,
    businessOwnerUserId: OPS_USERS.officerOdc,
    purpose: 'Publish ODC opportunities and notices in the Government Gazette and receive confirmations.',
    informationScope: 'Public notice text and released attachments.',
    recordOwnership: 'ODC owns the official notice versions; the Gazette owns its publication reference.',
    permittedRecipients: 'Government Gazette e-Notices gateway (public).',
    expectedTimeliness: 'Confirmation within 24 hours.',
    status: 'active',
    lastConfirmedAt: '2026-08-12T10:00:00Z',
    manualFallback: 'The council clerk lodges the notice at the Gazette office and scans the receipt.',
    contacts: [{ role: 'Business owner', name: 'Kefilwe Sekgoma', email: 'officer.odc@tenderiq.local' }],
    createdAt: '2026-02-20T08:00:00Z',
  },
  {
    id: 12,
    tenantId: ODC,
    systemType: 'records_management',
    name: 'Council records system',
    businessOwnerUserId: OPS_USERS.adminOdc,
    purpose: 'Transfer the exit export and signed contracts to the council records system (offboarding plan).',
    informationScope: 'Exit export packages, signed contracts and retention classifications.',
    recordOwnership: 'ODC becomes the records owner of each transferred record from the transfer date.',
    permittedRecipients: 'ODC records office.',
    expectedTimeliness: 'Within five working days of each export.',
    status: 'active',
    lastConfirmedAt: '2026-09-18T12:00:00Z',
    manualFallback: 'Encrypted export files are handed over on removable media against a signed receipt.',
    contacts: [{ role: 'Business owner', name: 'Wame Olebile', email: 'admin.odc@tenderiq.local' }],
    createdAt: '2026-09-15T08:00:00Z',
  },
] satisfies FixtureIntegrationConnection[]);

export interface FixtureIntegrationConfirmation {
  readonly id: number;
  readonly connectionId: number;
  readonly confirmedAt: string;
  readonly confirmedByUserId: number;
  readonly note: string | null;
}

export const INTEGRATION_CONFIRMATIONS: readonly FixtureIntegrationConfirmation[] = Object.freeze([
  { id: 7001, connectionId: 1, confirmedAt: '2026-09-02T09:15:00Z', confirmedByUserId: OPS_USERS.tebogoOfficer, note: 'Gazette references for T-2026-0002 v1 matched.' },
  { id: 7002, connectionId: 1, confirmedAt: '2026-08-17T16:05:00Z', confirmedByUserId: OPS_USERS.tebogoOfficer, note: 'T-2026-0008 notice confirmed.' },
  { id: 7003, connectionId: 2, confirmedAt: '2026-09-24T10:30:00Z', confirmedByUserId: OPS_USERS.masegoContracts, note: 'C-2026-0002 v2 envelope issued; v1 envelope voided.' },
  { id: 7004, connectionId: 3, confirmedAt: '2026-09-18T07:00:00Z', confirmedByUserId: OPS_USERS.lesegoFinance, note: 'Commitments to 17 Sep reconciled.' },
  { id: 7005, connectionId: 4, confirmedAt: '2026-09-30T05:00:00Z', confirmedByUserId: OPS_USERS.adminKwu, note: null },
  { id: 7006, connectionId: 6, confirmedAt: '2026-06-30T09:00:00Z', confirmedByUserId: OPS_USERS.mphoManager, note: 'Last lookup before the registry suspended its API.' },
  { id: 7011, connectionId: 11, confirmedAt: '2026-08-12T10:00:00Z', confirmedByUserId: OPS_USERS.officerOdc, note: null },
  { id: 7012, connectionId: 12, confirmedAt: '2026-09-18T12:00:00Z', confirmedByUserId: OPS_USERS.adminOdc, note: 'Preliminary exit export 3101 received by the records office.' },
] satisfies FixtureIntegrationConfirmation[]);

export interface FixtureIntegrationExceptionRow {
  readonly id: number;
  readonly tenantId: number;
  readonly connectionId: number;
  readonly recordType: IntegrationRecordType;
  readonly recordId: number;
  readonly recordLabel: string;
  readonly recordLink: string | null;
  readonly description: string;
  readonly status: IntegrationExceptionsStatus;
  readonly ownerUserId: number | null;
  readonly openedAt: string;
  readonly resolvedAt: string | null;
  readonly resolution: string | null;
  readonly unconfirmedEffect: string | null;
}

function publicationException(id: number, recordLabel: string, tenderId: number, unconfirmedEffect: string): FixtureIntegrationExceptionRow {
  const row = PUBLICATION_EXCEPTIONS.find((exception) => exception.id === id);
  if (row === undefined) {
    throw new Error(`Publication exception ${id} is missing from the publication fixture.`);
  }
  return {
    id: row.id,
    tenantId: row.tenantId,
    connectionId: 1,
    recordType: 'publication',
    recordId: row.recordId,
    recordLabel,
    recordLink: `/buyer/tenders/${tenderId}`,
    description: row.description,
    status: row.status,
    ownerUserId: row.ownerUserId,
    openedAt: row.openedAt,
    resolvedAt: row.resolvedAt,
    resolution: row.resolution,
    unconfirmedEffect: row.resolvedAt === null ? unconfirmedEffect : null,
  };
}

export const OPERATIONS_INTEGRATION_EXCEPTIONS: readonly FixtureIntegrationExceptionRow[] = Object.freeze([
  publicationException(
    901,
    'T-2026-0002 version 2 (addendum 1), external notice',
    2,
    'T-2026-0002 is not advertised externally for its current version until the Gazette notice is republished and reconciled.',
  ),
  publicationException(902, 'T-2026-0001 version 1, external notice', 1, 'The Gazette confirmation is not matched.'),
  {
    id: 903,
    tenantId: KWU,
    connectionId: 3,
    recordType: 'contract',
    recordId: 1,
    recordLabel: 'C-2026-0001 change request CR-0002 (Saturday emergency service hours) commitment',
    recordLink: '/buyer/contracts/1',
    description:
      'Finance has not acknowledged the commitment for the agreed change request CR-0002 on C-2026-0001. The available balance shown for cost centre OPS-FLEET-02 is 26 hours old.',
    status: 'investigating',
    ownerUserId: OPS_USERS.lesegoFinance,
    openedAt: '2026-09-28T09:00:00Z',
    resolvedAt: null,
    resolution: null,
    unconfirmedEffect: 'The commitment is not recorded as accepted by finance; the funding disposition stays explicit.',
  },
  {
    id: 904,
    tenantId: KWU,
    connectionId: 2,
    recordType: 'contract',
    recordId: 2,
    recordLabel: 'C-2026-0002 contract version 1 signature envelope',
    recordLink: '/buyer/contracts/2',
    description: 'The signature service still reported the voided version 1 envelope of C-2026-0002 as "awaiting signature" after version 2 was issued.',
    status: 'closed',
    ownerUserId: OPS_USERS.masegoContracts,
    openedAt: '2026-09-24T10:05:00Z',
    resolvedAt: '2026-09-24T10:30:00Z',
    resolution: 'Envelope for version 1 voided at the service; version 2 is the only open envelope. The contract remains unsigned.',
    unconfirmedEffect: null,
  },
  {
    id: 905,
    tenantId: KWU,
    connectionId: 4,
    recordType: 'membership',
    recordId: 21,
    recordLabel: 'Membership of Gaone Letsholo (procurement officer)',
    recordLink: null,
    description: 'The directory reported Gaone Letsholo as a leaver on 31 Aug 2026 while the membership was still active.',
    status: 'reconciled',
    ownerUserId: OPS_USERS.adminKwu,
    openedAt: '2026-09-01T05:00:00Z',
    resolvedAt: '2026-09-01T08:10:00Z',
    resolution: 'Membership deactivated; open work reassigned; historic approvals and submissions keep their original actor (AC-04).',
    unconfirmedEffect: null,
  },
  {
    id: 906,
    tenantId: ODC,
    connectionId: 11,
    recordType: 'publication',
    recordId: 1112,
    recordLabel: 'T-2026-0011 version 1, external notice',
    recordLink: '/buyer/tenders/11',
    description: 'No Gazette confirmation received for T-2026-0011 more than 48 hours after publication.',
    status: 'open',
    ownerUserId: OPS_USERS.officerOdc,
    openedAt: '2026-09-17T06:05:00Z',
    resolvedAt: null,
    resolution: null,
    unconfirmedEffect: 'T-2026-0011 is not confirmed as advertised in the Gazette.',
  },
] satisfies FixtureIntegrationExceptionRow[]);

export interface FixtureExceptionHistory {
  readonly id: number;
  readonly exceptionId: number;
  readonly at: string;
  readonly actorUserId: number | null;
  readonly action: string;
  readonly description: string;
}

export const INTEGRATION_EXCEPTION_HISTORY: readonly FixtureExceptionHistory[] = Object.freeze([
  { id: 8001, exceptionId: 901, at: '2026-09-22T09:04:00Z', actorUserId: null, action: 'exception.opened', description: 'Gateway returned HTTP 413: the addendum attachment exceeds 5 MB.' },
  { id: 8002, exceptionId: 901, at: '2026-09-22T09:05:00Z', actorUserId: null, action: 'exception.assigned', description: 'Assigned to the tender owner with a task.' },
  { id: 8011, exceptionId: 902, at: '2026-06-02T19:00:00Z', actorUserId: null, action: 'exception.opened', description: 'Confirmation arrived after the matching window.' },
  { id: 8012, exceptionId: 902, at: '2026-06-03T07:30:00Z', actorUserId: OPS_USERS.tebogoOfficer, action: 'exception.reconciled', description: 'Reference BGG-2026-06-1187 matched to version 1.' },
  { id: 8021, exceptionId: 903, at: '2026-09-28T09:00:00Z', actorUserId: null, action: 'exception.opened', description: 'No acknowledgement within one working day.' },
  { id: 8022, exceptionId: 903, at: '2026-09-29T08:20:00Z', actorUserId: OPS_USERS.lesegoFinance, action: 'exception.investigating', description: 'Finance batch job failed on 27 Sep; rerun requested.' },
  { id: 8031, exceptionId: 904, at: '2026-09-24T10:05:00Z', actorUserId: null, action: 'exception.opened', description: 'Status mismatch between service and contract record.' },
  { id: 8032, exceptionId: 904, at: '2026-09-24T10:30:00Z', actorUserId: OPS_USERS.masegoContracts, action: 'exception.closed', description: 'Voided the old envelope.' },
  { id: 8041, exceptionId: 905, at: '2026-09-01T05:00:00Z', actorUserId: null, action: 'exception.opened', description: 'Leaver reported by the directory.' },
  { id: 8042, exceptionId: 905, at: '2026-09-01T08:10:00Z', actorUserId: OPS_USERS.adminKwu, action: 'exception.reconciled', description: 'Membership deactivated.' },
  { id: 8051, exceptionId: 906, at: '2026-09-17T06:05:00Z', actorUserId: null, action: 'exception.opened', description: 'Confirmation overdue.' },
] satisfies FixtureExceptionHistory[]);
