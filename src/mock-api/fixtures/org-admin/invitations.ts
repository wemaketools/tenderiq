/**
 * Org-admin fixtures: invitations (FR-03, COM-01, ADM-03, SUP-04; DD-06, DD-18, DD-27).
 *
 * Every invitation state is present: pending (buyers and suppliers), expired (stored `expired` after the
 * `expire-access` job, and stored `pending` past its expiry, which the request-time check reports as expired),
 * send_failed, accepted, revoked and a reissue chain. The ODC invitation to `dineo.legal` is addressed to a demo
 * account, so COM-01 acceptance can be demonstrated signed in (token `odc-inv-dineo-masire-3b9e7a12`).
 * Tokens are the link values of `/invite/:token`; the database stores only their hash.
 */
import type { InvitationsStatus } from '../../../contracts/enums.js';
import { PERSONA_EMAIL_DOMAIN, TENANT_IDS } from '../platform.js';
import { uid } from './refs.js';

export interface FixtureInvitation {
  readonly invitationId: number;
  readonly tenantId: number;
  readonly token: string;
  readonly email: string;
  readonly fullName: string | null;
  readonly userId: number | null;
  readonly membershipId: number | null;
  readonly capacity: string;
  readonly roleCodes: readonly string[];
  readonly status: InvitationsStatus;
  readonly expiresAt: string;
  readonly sentCount: number;
  readonly invitedByUserId: number;
  readonly createdAt: string;
  readonly acceptedAt: string | null;
  readonly reissuedFromId: number | null;
  readonly revokedReason: string | null;
}

export const INVITATIONS: readonly FixtureInvitation[] = Object.freeze([
  // Kalahari Water Utilities
  {
    invitationId: 1, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-naledi-moyo-8f2c41d7', email: 'naledi.moyo@kwu.co.bw',
    fullName: 'Naledi Moyo', userId: 103, membershipId: 503, capacity: 'Procurement Officer', roleCodes: ['procurement_officer'],
    status: 'pending', expiresAt: '2026-10-23T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-09-25T08:30:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 2, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-kopano-dube-5a1d93e0', email: 'kopano.dube@kwu.co.bw',
    fullName: 'Kopano Dube', userId: 104, membershipId: 504, capacity: 'Evaluator, Hydrology', roleCodes: ['evaluator'],
    status: 'expired', expiresAt: '2026-09-20T15:00:00Z', sentCount: 2, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-09-06T09:00:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 3, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-tlotlo-ramasedi-c07e2b19', email: 'tlotlo.ramasedi@kwu.co.bw',
    fullName: 'Tlotlo Ramasedi', userId: 105, membershipId: 505, capacity: 'Budget Analyst', roleCodes: ['budget_owner'],
    status: 'send_failed', expiresAt: '2026-10-26T15:00:00Z', sentCount: 0, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-09-28T11:15:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 4, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-mothusi-kgari-1e44a0b8', email: 'mothusi.kgari@kwu.co.bw',
    fullName: 'Mothusi Kgari', userId: 106, membershipId: 506, capacity: 'Contract Administrator', roleCodes: ['contract_manager'],
    status: 'reissued', expiresAt: '2026-09-03T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-08-20T10:00:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 5, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-mothusi-kgari-r2-6d0f7c55', email: 'mothusi.kgari@kwu.co.bw',
    fullName: 'Mothusi Kgari', userId: 106, membershipId: 506, capacity: 'Contract Administrator', roleCodes: ['contract_manager'],
    status: 'pending', expiresAt: '2026-11-05T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-09-22T07:50:00Z', acceptedAt: null, reissuedFromId: 4, revokedReason: null,
  },
  {
    invitationId: 6, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-sam-keitumetse-0b7d6e21', email: `sam.dual@${PERSONA_EMAIL_DOMAIN}`,
    fullName: 'Sam Keitumetse', userId: uid('sam.dual'), membershipId: null, capacity: 'Evaluator, Engineering', roleCodes: ['evaluator'],
    status: 'accepted', expiresAt: '2026-04-08T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-03-25T08:00:00Z', acceptedAt: '2026-04-01T06:55:00Z', reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 7, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-lebogang-seane-9ab3f40c', email: 'lebogang.seane@consult.co.bw',
    fullName: 'Lebogang Seane', userId: 107, membershipId: 507, capacity: 'External Technical Adviser', roleCodes: ['evaluator'],
    status: 'revoked', expiresAt: '2026-09-24T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-09-10T09:40:00Z', acceptedAt: null, reissuedFromId: null,
    revokedReason: 'The advisory engagement was not approved.',
  },
  {
    invitationId: 8, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-kgomotso-mogapi-44e1a9d2', email: 'kgomotso.mogapi@kwu.co.bw',
    fullName: 'Kgomotso Mogapi', userId: 108, membershipId: 508, capacity: 'Records Officer', roleCodes: ['records_officer'],
    status: 'accepted', expiresAt: '2026-09-08T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2026-08-25T08:00:00Z', acceptedAt: '2026-09-01T06:40:00Z', reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 9, tenantId: TENANT_IDS.kwu, token: 'kwu-inv-gaone-letsholo-73c2d8aa', email: `former.officer@${PERSONA_EMAIL_DOMAIN}`,
    fullName: 'Gaone Letsholo', userId: uid('former.officer'), membershipId: null, capacity: 'Procurement Officer', roleCodes: ['procurement_officer'],
    status: 'accepted', expiresAt: '2025-11-10T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.kwu'),
    createdAt: '2025-10-27T08:00:00Z', acceptedAt: '2025-11-03T06:30:00Z', reissuedFromId: null, revokedReason: null,
  },
  // Okavango District Council
  {
    invitationId: 10, tenantId: TENANT_IDS.odc, token: 'odc-inv-dineo-masire-3b9e7a12', email: `dineo.legal@${PERSONA_EMAIL_DOMAIN}`,
    fullName: 'Dineo Masire', userId: uid('dineo.legal'), membershipId: 514, capacity: 'Legal Adviser (shared service)',
    roleCodes: ['legal_reviewer'], status: 'pending', expiresAt: '2026-12-15T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.odc'),
    createdAt: '2026-09-29T09:00:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 11, tenantId: TENANT_IDS.odc, token: 'odc-inv-tumisang-letsweletse-e2f18c07', email: 'tumisang.letsweletse@odc.gov.bw',
    fullName: 'Tumisang Letsweletse', userId: 111, membershipId: 511, capacity: 'Works Engineer', roleCodes: ['requester'],
    status: 'pending', expiresAt: '2026-10-30T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.odc'),
    createdAt: '2026-09-23T07:45:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 12, tenantId: TENANT_IDS.odc, token: 'odc-inv-oarabile-ntwayagae-5c93b1f0', email: 'oarabile.ntwayagae@odc.gov.bw',
    fullName: 'Oarabile Ntwayagae', userId: 113, membershipId: 513, capacity: 'Finance Officer', roleCodes: ['budget_owner'],
    status: 'accepted', expiresAt: '2026-03-16T15:00:00Z', sentCount: 1, invitedByUserId: uid('admin.odc'),
    createdAt: '2026-03-02T07:00:00Z', acceptedAt: '2026-03-09T06:50:00Z', reissuedFromId: null, revokedReason: null,
  },
  // Suppliers
  {
    invitationId: 13, tenantId: TENANT_IDS.tsodilo, token: 'tsodilo-inv-lorato-mosweu-a81d0e3c', email: 'lorato.mosweu@tsodilo.co.bw',
    fullName: 'Lorato Mosweu', userId: 122, membershipId: 522, capacity: 'Commercial Contributor', roleCodes: ['commercial_contributor'],
    status: 'pending', expiresAt: '2026-11-10T15:00:00Z', sentCount: 1, invitedByUserId: uid('tsodilo.admin'),
    createdAt: '2026-09-27T08:05:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 14, tenantId: TENANT_IDS.tsodilo, token: 'tsodilo-inv-sam-keitumetse-2f6b9c40', email: `sam.dual@${PERSONA_EMAIL_DOMAIN}`,
    fullName: 'Sam Keitumetse', userId: uid('sam.dual'), membershipId: null, capacity: 'Technical Contributor', roleCodes: ['contributor'],
    status: 'accepted', expiresAt: '2026-04-17T15:00:00Z', sentCount: 1, invitedByUserId: uid('tsodilo.admin'),
    createdAt: '2026-04-03T08:00:00Z', acceptedAt: '2026-04-10T06:45:00Z', reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 15, tenantId: TENANT_IDS['chobe-pipe'], token: 'chobe-inv-dikeledi-phiri-0d5e7f18', email: 'dikeledi.phiri@chobepipe.co.bw',
    fullName: 'Dikeledi Phiri', userId: 123, membershipId: 523, capacity: 'Finance Officer', roleCodes: ['supplier_finance'],
    status: 'pending', expiresAt: '2026-09-15T15:00:00Z', sentCount: 1, invitedByUserId: uid('chobe-pipe.admin'),
    createdAt: '2026-09-01T10:20:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 16, tenantId: TENANT_IDS.makgadikgadi, token: 'makgadikgadi-inv-masego-sebati-7b2c4d91', email: 'masego.sebati@makgadikgadi.co.bw',
    fullName: 'Masego Sebati', userId: 125, membershipId: 525, capacity: 'Finance Officer', roleCodes: ['supplier_finance'],
    status: 'pending', expiresAt: '2026-11-01T15:00:00Z', sentCount: 1, invitedByUserId: uid('makgadikgadi.admin'),
    createdAt: '2026-09-29T13:00:00Z', acceptedAt: null, reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 17, tenantId: TENANT_IDS.tsodilo, token: 'tsodilo-inv-ditiro-kebonang-58a3e6b2', email: `tsodilo.contributor@${PERSONA_EMAIL_DOMAIN}`,
    fullName: 'Ditiro Kebonang', userId: uid('tsodilo.contributor'), membershipId: null, capacity: 'Technical Contributor',
    roleCodes: ['contributor'], status: 'accepted', expiresAt: '2026-03-09T15:00:00Z', sentCount: 1, invitedByUserId: uid('tsodilo.admin'),
    createdAt: '2026-02-23T08:00:00Z', acceptedAt: '2026-03-02T06:35:00Z', reissuedFromId: null, revokedReason: null,
  },
  {
    invitationId: 18, tenantId: TENANT_IDS['gaborone-meter'], token: 'gabmeter-inv-thabiso-kgosana-3e9d2a71', email: 'thabiso.kgosana@gabmeter.co.bw',
    fullName: 'Thabiso Kgosana', userId: 124, membershipId: 524, capacity: 'Commercial Contributor', roleCodes: ['commercial_contributor'],
    status: 'accepted', expiresAt: '2026-04-13T15:00:00Z', sentCount: 1, invitedByUserId: uid('gaborone-meter.admin'),
    createdAt: '2026-03-30T08:00:00Z', acceptedAt: '2026-04-06T06:20:00Z', reissuedFromId: null, revokedReason: null,
  },
] satisfies FixtureInvitation[]);
