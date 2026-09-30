/**
 * Org-admin fixtures: direct grants, restrictions, segregation-of-duties policies and conflict declarations
 * (ADM-04, ADM-05; PRD §4.2, §5.4; DD-25; AC-02).
 *
 * - Grants are all `org.*` codes: the KWU administrator who granted them holds those, and nobody grants what they do
 *   not hold. Every display status is present (scheduled, active, expiring soon, expired, revoked).
 * - `sam.dual` (evaluator at KWU, contributor at Tsodilo and Chobe) declared bid-preparation involvement for
 *   T-2026-0003: the declaration is pending review and a conflict restriction blocks his restricted access (AC-02).
 * - ODC has adopted documented alternative oversight for two rules and not yet configured the others.
 */
import type {
  AccessRestrictionsRestrictionType,
  ConflictDeclarationsDisposition,
  ConflictDeclarationsNature,
  ConflictDeclarationsSubjectType,
  RoleAssignmentsScopeType,
  SodPoliciesMode,
  SodPoliciesRuleCode,
} from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import { TENANT_IDS } from '../platform.js';
import { uid } from './refs.js';

export interface FixtureScope {
  readonly scopeType: RoleAssignmentsScopeType;
  readonly scopeId: number | null;
  readonly scopeLabel: string;
}

const ORGANIZATION: FixtureScope = { scopeType: 'organization', scopeId: null, scopeLabel: 'Whole organization' };

export interface FixtureAccessGrant {
  readonly grantId: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly permissionCode: PermissionCode;
  readonly scope: FixtureScope;
  readonly reason: string;
  readonly ownerUserId: number;
  readonly grantedByUserId: number;
  readonly startsAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly revokedByUserId: number | null;
}

export const ACCESS_GRANTS: readonly FixtureAccessGrant[] = Object.freeze([
  {
    grantId: 1, tenantId: TENANT_IDS.kwu, userId: uid('kagiso.requester'), permissionCode: 'org.structure.manage',
    scope: { scopeType: 'department', scopeId: 11, scopeLabel: 'Operations department' },
    reason: 'Maintain Operations cost centres during the FY2027 budget restructure.', ownerUserId: uid('onalenna.budget'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-09-01T07:00:00Z', expiresAt: '2026-10-20T15:00:00Z', revokedAt: null, revokedByUserId: null,
  },
  {
    grantId: 2, tenantId: TENANT_IDS.kwu, userId: uid('tebogo.officer'), permissionCode: 'org.templates.manage', scope: ORGANIZATION,
    reason: 'Draft the new RFQ template set for the 2027 procurement plan.', ownerUserId: uid('mpho.manager'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-08-15T07:00:00Z', expiresAt: '2027-01-31T15:00:00Z', revokedAt: null, revokedByUserId: null,
  },
  {
    grantId: 3, tenantId: TENANT_IDS.kwu, userId: uid('masego.contracts'), permissionCode: 'org.calendars.manage', scope: ORGANIZATION,
    reason: 'Load the 2026 public holidays after the gazette change.', ownerUserId: uid('admin.kwu'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-08-03T07:00:00Z', expiresAt: '2026-08-31T15:00:00Z', revokedAt: null, revokedByUserId: null,
  },
  {
    grantId: 4, tenantId: TENANT_IDS.kwu, userId: uid('dineo.legal'), permissionCode: 'org.policy.manage', scope: ORGANIZATION,
    reason: 'Redraft the complaints section of the procurement policy.', ownerUserId: uid('mpho.manager'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-07-01T07:00:00Z', expiresAt: '2026-10-31T15:00:00Z',
    revokedAt: '2026-09-10T11:00:00Z', revokedByUserId: uid('admin.kwu'),
  },
  {
    grantId: 5, tenantId: TENANT_IDS.kwu, userId: uid('lesego.finance'), permissionCode: 'org.imports.manage', scope: ORGANIZATION,
    reason: 'Import the legacy supplier payment history for the records migration.', ownerUserId: uid('onalenna.budget'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-11-02T07:00:00Z', expiresAt: '2026-12-18T15:00:00Z', revokedAt: null, revokedByUserId: null,
  },
  {
    grantId: 6, tenantId: TENANT_IDS.kwu, userId: uid('former.officer'), permissionCode: 'org.users.view', scope: ORGANIZATION,
    reason: 'Maintain the evaluator roster for T-2026-0007.', ownerUserId: uid('mpho.manager'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-05-04T07:00:00Z', expiresAt: '2026-08-31T15:00:00Z',
    revokedAt: '2026-07-01T15:00:00Z', revokedByUserId: uid('admin.kwu'),
  },
  {
    grantId: 7, tenantId: TENANT_IDS.kwu, userId: uid('pule.auditor'), permissionCode: 'org.access.review', scope: ORGANIZATION,
    reason: 'Annual access recertification 2026 by Internal Audit.', ownerUserId: uid('admin.kwu'),
    grantedByUserId: uid('admin.kwu'), startsAt: '2026-09-15T07:00:00Z', expiresAt: '2026-11-27T15:00:00Z', revokedAt: null, revokedByUserId: null,
  },
  {
    grantId: 8, tenantId: TENANT_IDS.odc, userId: uid('officer.odc'), permissionCode: 'org.portal.manage', scope: ORGANIZATION,
    reason: 'Publish the Council procurement guidance page.', ownerUserId: uid('admin.odc'),
    grantedByUserId: uid('admin.odc'), startsAt: '2026-09-01T07:00:00Z', expiresAt: '2026-12-31T15:00:00Z', revokedAt: null, revokedByUserId: null,
  },
] satisfies FixtureAccessGrant[]);

export interface FixtureAccessRestriction {
  readonly restrictionId: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly permissionCode: PermissionCode | null;
  readonly scope: FixtureScope;
  readonly restrictionType: AccessRestrictionsRestrictionType;
  readonly reason: string;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly imposedByUserId: number | null;
  readonly conflictDeclarationId: number | null;
}

const T3: FixtureScope = { scopeType: 'tender', scopeId: 3, scopeLabel: 'T-2026-0003 SCADA telemetry upgrade' };

export const ACCESS_RESTRICTIONS: readonly FixtureAccessRestriction[] = Object.freeze([
  {
    restrictionId: 1, tenantId: TENANT_IDS.kwu, userId: uid('sam.dual'), permissionCode: null, scope: T3, restrictionType: 'conflict',
    reason: 'Conflict declaration pending review: bid-preparation involvement with Tsodilo Engineering.',
    startsAt: '2026-09-15T08:10:00Z', endsAt: null, imposedByUserId: uid('boitumelo.chair'), conflictDeclarationId: 1,
  },
  {
    restrictionId: 2, tenantId: TENANT_IDS.kwu, userId: 102, permissionCode: null, scope: ORGANIZATION, restrictionType: 'suspension',
    reason: 'Suspended pending an HR disciplinary process.', startsAt: '2026-09-18T07:00:00Z', endsAt: null,
    imposedByUserId: uid('admin.kwu'), conflictDeclarationId: null,
  },
  {
    restrictionId: 3, tenantId: TENANT_IDS.kwu, userId: uid('kabo.eval'), permissionCode: 'evaluation.score',
    scope: { scopeType: 'tender', scopeId: 9, scopeLabel: 'T-2026-0009 Acoustic leak detection services' },
    restrictionType: 'confidentiality', reason: 'Confidentiality undertaking for T-2026-0009 not yet signed.',
    startsAt: '2026-08-03T07:00:00Z', endsAt: '2026-08-20T09:30:00Z', imposedByUserId: uid('boitumelo.chair'), conflictDeclarationId: null,
  },
  {
    restrictionId: 4, tenantId: TENANT_IDS.kwu, userId: uid('amantle.eval'), permissionCode: 'evaluation.commercial',
    scope: { scopeType: 'tender', scopeId: 2, scopeLabel: 'T-2026-0002 Smart water meter supply' },
    restrictionType: 'conflict', reason: 'Mitigation: no commercial evaluation of Gaborone Metering Co. (former employer).',
    startsAt: '2026-09-05T10:00:00Z', endsAt: null, imposedByUserId: uid('mpho.manager'), conflictDeclarationId: 4,
  },
  {
    restrictionId: 5, tenantId: TENANT_IDS.kwu, userId: uid('boitumelo.chair'), permissionCode: null,
    scope: { scopeType: 'tender', scopeId: 7, scopeLabel: 'T-2026-0007 Reservoir rehabilitation works' },
    restrictionType: 'conflict', reason: 'Recused: financial interest in Limpopo Environmental Services.',
    startsAt: '2026-08-28T12:00:00Z', endsAt: null, imposedByUserId: uid('mpho.manager'), conflictDeclarationId: 6,
  },
  {
    restrictionId: 6, tenantId: TENANT_IDS['gaborone-meter'], userId: 124, permissionCode: null, scope: ORGANIZATION,
    restrictionType: 'suspension', reason: 'Suspended while a pricing-data handling incident is investigated.',
    startsAt: '2026-09-22T07:00:00Z', endsAt: null, imposedByUserId: uid('gaborone-meter.admin'), conflictDeclarationId: null,
  },
] satisfies FixtureAccessRestriction[]);

export interface FixtureSodPolicy {
  readonly tenantId: number;
  readonly ruleCode: SodPoliciesRuleCode;
  readonly mode: SodPoliciesMode;
  readonly alternativeOversightNote: string | null;
  readonly approvedByUserId: number | null;
  readonly effectiveFrom: string;
}

export const SOD_POLICIES: readonly FixtureSodPolicy[] = Object.freeze([
  { tenantId: TENANT_IDS.kwu, ruleCode: 'draft_vs_final_approval', mode: 'enforced', alternativeOversightNote: null, approvedByUserId: uid('mpho.manager'), effectiveFrom: '2026-04-01T00:00:00Z' },
  { tenantId: TENANT_IDS.kwu, ruleCode: 'submission_custody_vs_opening', mode: 'enforced', alternativeOversightNote: null, approvedByUserId: uid('mpho.manager'), effectiveFrom: '2026-04-01T00:00:00Z' },
  { tenantId: TENANT_IDS.kwu, ruleCode: 'evaluation_vs_award_approval', mode: 'enforced', alternativeOversightNote: null, approvedByUserId: uid('keabetswe.approver'), effectiveFrom: '2026-04-01T00:00:00Z' },
  {
    tenantId: TENANT_IDS.kwu, ruleCode: 'supplier_assessment_vs_exception_approval', mode: 'alternative_oversight',
    alternativeOversightNote: 'Where the procurement manager both assesses and approves an exclusion, Internal Audit reviews the file within five working days.',
    approvedByUserId: uid('keabetswe.approver'), effectiveFrom: '2026-04-01T00:00:00Z',
  },
  { tenantId: TENANT_IDS.kwu, ruleCode: 'requester_vs_request_approval', mode: 'enforced', alternativeOversightNote: null, approvedByUserId: uid('mpho.manager'), effectiveFrom: '2026-04-01T00:00:00Z' },
  {
    tenantId: TENANT_IDS.odc, ruleCode: 'draft_vs_final_approval', mode: 'alternative_oversight',
    alternativeOversightNote: 'The Council Secretary reviews and countersigns every release approval because only two procurement staff exist.',
    approvedByUserId: uid('admin.odc'), effectiveFrom: '2026-03-01T00:00:00Z',
  },
  {
    tenantId: TENANT_IDS.odc, ruleCode: 'submission_custody_vs_opening', mode: 'alternative_oversight',
    alternativeOversightNote: 'Bid openings are witnessed by a councillor and minuted; the minutes are published to the audit file.',
    approvedByUserId: uid('admin.odc'), effectiveFrom: '2026-03-01T00:00:00Z',
  },
] satisfies FixtureSodPolicy[]);

export interface FixtureConflictDeclaration {
  readonly declarationId: number;
  readonly tenantId: number;
  readonly userId: number;
  readonly subjectType: ConflictDeclarationsSubjectType;
  readonly subjectId: number;
  readonly subjectReference: string | null;
  readonly subjectTitle: string;
  readonly supplierTenantId: number | null;
  readonly hasConflict: boolean;
  readonly nature: ConflictDeclarationsNature | null;
  readonly details: string | null;
  readonly declaredAt: string;
  readonly disposition: ConflictDeclarationsDisposition;
  readonly reviewedByUserId: number | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export const CONFLICT_DECLARATIONS: readonly FixtureConflictDeclaration[] = Object.freeze([
  {
    declarationId: 1, tenantId: TENANT_IDS.kwu, userId: uid('sam.dual'), subjectType: 'tender', subjectId: 3,
    subjectReference: 'T-2026-0003', subjectTitle: 'SCADA telemetry upgrade', supplierTenantId: TENANT_IDS.tsodilo,
    hasConflict: true, nature: 'bid_preparation',
    details: 'I am a technical contributor at Tsodilo Engineering and reviewed parts of their SCADA architecture section before my evaluator appointment.',
    declaredAt: '2026-09-15T08:10:00Z', disposition: 'pending_review', reviewedByUserId: null, reviewedAt: null, reviewNote: null,
  },
  {
    declarationId: 2, tenantId: TENANT_IDS.kwu, userId: uid('sam.dual'), subjectType: 'tender', subjectId: 6,
    subjectReference: 'T-2026-0006', subjectTitle: 'Chlorine dosing equipment', supplierTenantId: TENANT_IDS['chobe-pipe'],
    hasConflict: true, nature: 'bid_preparation',
    details: 'Chobe Pipe & Valve Supplies asked me to prepare the dosing panel datasheets for their response.',
    declaredAt: '2026-09-02T07:30:00Z', disposition: 'reassigned', reviewedByUserId: uid('boitumelo.chair'), reviewedAt: '2026-09-04T09:00:00Z',
    reviewNote: 'Evaluation assignment moved to Boipelo Sebina.',
  },
  {
    declarationId: 3, tenantId: TENANT_IDS.kwu, userId: uid('thato.eval'), subjectType: 'tender', subjectId: 3,
    subjectReference: 'T-2026-0003', subjectTitle: 'SCADA telemetry upgrade', supplierTenantId: null,
    hasConflict: false, nature: null, details: null,
    declaredAt: '2026-09-08T06:45:00Z', disposition: 'cleared', reviewedByUserId: uid('boitumelo.chair'), reviewedAt: '2026-09-10T08:00:00Z',
    reviewNote: 'No interest declared.',
  },
  {
    declarationId: 4, tenantId: TENANT_IDS.kwu, userId: uid('amantle.eval'), subjectType: 'tender', subjectId: 2,
    subjectReference: 'T-2026-0002', subjectTitle: 'Smart water meter supply', supplierTenantId: TENANT_IDS['gaborone-meter'],
    hasConflict: true, nature: 'prior_employment', details: 'Employed by Gaborone Metering Co. as a laboratory analyst until March 2023.',
    declaredAt: '2026-09-03T12:00:00Z', disposition: 'mitigated', reviewedByUserId: uid('mpho.manager'), reviewedAt: '2026-09-05T10:00:00Z',
    reviewNote: 'May score technical criteria; excluded from the commercial comparison of Gaborone Metering Co.',
  },
  {
    declarationId: 5, tenantId: TENANT_IDS.kwu, userId: uid('neo.assessor'), subjectType: 'qualification_application', subjectId: 503,
    subjectReference: 'QA-2026-0006', subjectTitle: 'Makgadikgadi Civil Works — Category A qualification', supplierTenantId: TENANT_IDS.makgadikgadi,
    hasConflict: false, nature: null, details: null,
    declaredAt: '2026-09-11T07:15:00Z', disposition: 'cleared', reviewedByUserId: uid('mpho.manager'), reviewedAt: '2026-09-11T11:30:00Z',
    reviewNote: null,
  },
  {
    declarationId: 6, tenantId: TENANT_IDS.kwu, userId: uid('boitumelo.chair'), subjectType: 'tender', subjectId: 7,
    subjectReference: 'T-2026-0007', subjectTitle: 'Reservoir rehabilitation works', supplierTenantId: TENANT_IDS['limpopo-env'],
    hasConflict: true, nature: 'financial_interest', details: 'A close family member holds shares in Limpopo Environmental Services.',
    declaredAt: '2026-08-27T09:00:00Z', disposition: 'recused', reviewedByUserId: uid('mpho.manager'), reviewedAt: '2026-08-28T12:00:00Z',
    reviewNote: 'Recused from the complaint review and award recommendation of T-2026-0007.',
  },
  {
    declarationId: 7, tenantId: TENANT_IDS.kwu, userId: uid('kabo.eval'), subjectType: 'tender', subjectId: 9,
    subjectReference: 'T-2026-0009', subjectTitle: 'Acoustic leak detection services', supplierTenantId: TENANT_IDS['serowe-ict'],
    hasConflict: true, nature: 'personal_relationship', details: 'My brother-in-law is a field technician at Serowe ICT Solutions.',
    declaredAt: '2026-09-27T14:05:00Z', disposition: 'pending_review', reviewedByUserId: null, reviewedAt: null, reviewNote: null,
  },
  {
    declarationId: 8, tenantId: TENANT_IDS.odc, userId: uid('officer.odc'), subjectType: 'tender', subjectId: 11,
    subjectReference: 'T-2026-0011', subjectTitle: 'Office cleaning services', supplierTenantId: null,
    hasConflict: false, nature: null, details: null,
    declaredAt: '2026-09-21T08:00:00Z', disposition: 'cleared', reviewedByUserId: uid('admin.odc'), reviewedAt: '2026-09-21T10:00:00Z',
    reviewNote: null,
  },
] satisfies FixtureConflictDeclaration[]);
