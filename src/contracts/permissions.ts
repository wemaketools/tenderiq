/**
 * The permission catalog and the role-template matrix (schema-blueprint §P, DD-23, PRD §4.1, §4.2).
 *
 * This file is the single source for both stages:
 * - Stage A: the mock API computes each persona's effective permissions from the templates below and enforces
 *   every endpoint's declared `permission` against them (architecture-plan §3.2).
 * - Stage B: `supabase/seed.sql` (tables `permissions`, `role_templates`, `role_template_permissions`) is
 *   generated from, and unit-tested against, this file (docs/technical/04-security-model.md §5.2, §18 item 17).
 *
 * Restrictions carried from PRD §4.1 and blueprint §P, enforced by the unit tests:
 * - `org_admin` holds `org.*` only: no tender content, bids, evaluation or financial evidence (BR-26, AC-15).
 * - `auditor` is read-only (+ `audit.view`, `export.create`) with no sealed, scoring or command access.
 * - `support.view` belongs to no template: an operator receives it only through an active, customer-authorized
 *   support access grant (OPS-04, ADR 0013).
 * - A template only holds permissions of its own tenant kind (a supplier administrator can never grant buyer
 *   privileges).
 * - Nobody can grant what they do not hold; that is enforced at assignment time by the backend.
 *
 * Pure module: zod only.
 */
import { z } from 'zod';

/** `permissions.tenant_kind` (blueprint Migration 01). */
export const PERMISSION_TENANT_KINDS = ['buyer', 'supplier', 'operator', 'any'] as const;
export type PermissionTenantKind = (typeof PERMISSION_TENANT_KINDS)[number];

interface PermissionDefinition {
  readonly tenantKind: PermissionTenantKind;
  readonly category: string;
  readonly description: string;
}

/** Every permission code, with its tenant kind, category and description (the `permissions` seed rows). */
export const PERMISSION_CATALOG = {
  // Buyer: organization administration
  'org.settings.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain organization settings, identity defaults and procurement configuration (ADM-01).',
  },
  'org.structure.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain legal entities, departments, locations, categories, cost centers and funding (ADM-01, ADM-02).',
  },
  'org.users.view': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'View the user directory, memberships, roles and outstanding work (ADM-03).',
  },
  'org.users.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Invite, activate, suspend and deactivate users and reassign their responsibilities (ADM-03).',
  },
  'org.roles.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain roles, groups, scoped assignments, direct grants and restrictions (ADM-04).',
  },
  'org.access.review': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Inspect effective access and review expiring or conflicting authority (ADM-04).',
  },
  'org.authority.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain authority limits, committees, delegations and segregation-of-duties policies (ADM-05).',
  },
  'org.policy.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Author procurement policy profiles and versions (ADM-06).',
  },
  'org.policy.approve': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Approve and retire procurement policy profile versions (ADM-06).',
  },
  'org.templates.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Author templates and library content (ADM-08).',
  },
  'org.templates.approve': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Approve, publish for reuse and retire templates (ADM-08).',
  },
  'org.fields.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Configure custom business fields (ADM-07).',
  },
  'org.calendars.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain and approve working calendars and holidays; review deadline impact (ADM-10).',
  },
  'org.portal.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain public portal and publication policy settings (ADM-11).',
  },
  'org.notifications.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain notification rules and message templates (ADM-12).',
  },
  'org.integrations.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Maintain the integration register and reconcile exceptions (ADM-15).',
  },
  'org.imports.manage': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Review and accept historical imports and duplicate candidates (ADM-16).',
  },
  'org.subscription.view': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'View the subscription, entitlements and offboarding plan (ADM-17).',
  },
  'org.support_access.authorize': {
    tenantKind: 'buyer',
    category: 'organization',
    description: 'Authorize or revoke a time-limited operator support access grant (DD-23, OPS-04).',
  },
  // Buyer: requests and strategy
  'request.create': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Create, edit and submit own procurement requests (BUY-02, BUY-03).',
  },
  'request.view_all': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'View every procurement request in scope, not only own requests (BUY-02).',
  },
  'request.review': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Review requests, ask for information, combine or split them (BUY-04).',
  },
  'request.approve': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Decide request approvals within authority (BUY-04, AC-05).',
  },
  'request.funding_confirm': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Confirm funding for a request within authority (BUY-04).',
  },
  'plan.manage': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Maintain the procurement plan and advance notices (BUY-05, PUB-06).',
  },
  'strategy.manage': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Prepare procurement strategies and market research (BUY-06).',
  },
  'strategy.approve': {
    tenantKind: 'buyer',
    category: 'requests',
    description: 'Approve procurement strategies within authority (BUY-06).',
  },
  // Buyer: suppliers and qualification
  'supplier.directory.view': {
    tenantKind: 'buyer',
    category: 'suppliers',
    description: 'View the supplier directory and relationship records (BUY-31, BUY-32).',
  },
  'supplier.relationship.manage': {
    tenantKind: 'buyer',
    category: 'suppliers',
    description: 'Maintain buyer-supplier relationships, contacts and provisional supplier records (BUY-32).',
  },
  'supplier.duplicates.review': {
    tenantKind: 'buyer',
    category: 'suppliers',
    description: 'Review possible duplicate supplier organizations (BUY-31, BR-44).',
  },
  'qualification.program.manage': {
    tenantKind: 'buyer',
    category: 'qualification',
    description: 'Establish and revise qualification programs (ADM-09).',
  },
  'qualification.review': {
    tenantKind: 'buyer',
    category: 'qualification',
    description: 'Assess assigned qualification applications and record findings (BUY-33, BUY-34).',
  },
  'qualification.financial_review': {
    tenantKind: 'buyer',
    category: 'qualification',
    description: 'Review assigned supplier financial evidence (BUY-34, AC-08).',
  },
  'qualification.decide': {
    tenantKind: 'buyer',
    category: 'qualification',
    description: 'Decide qualification outcomes within authority (BUY-35).',
  },
  // Buyer: tenders
  'tender.view': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'View tenders within assignment and scope (BUY-07).',
  },
  'tender.create': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Create tenders from requests, templates or earlier events (BUY-08).',
  },
  'tender.edit': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Author tender content, lots, requirements, pricing and evaluation plans (BUY-08..BUY-12).',
  },
  'tender.release_approve': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Approve a tender package for release within authority (BUY-13, AC-06).',
  },
  'tender.publish': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Publish or schedule an approved tender (BUY-14).',
  },
  'tender.participants.manage': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Invite suppliers and decide access requests (BUY-15).',
  },
  'tender.clarifications.manage': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Answer questions and prepare addenda (BUY-16, BUY-17).',
  },
  'tender.addenda.approve': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Approve addenda for issue (BUY-17).',
  },
  'tender.sessions.manage': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Manage briefings and site visits (BUY-18).',
  },
  'tender.close': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Close a tender by approved closure (BUY-19).',
  },
  'tender.cancel': {
    tenantKind: 'buyer',
    category: 'tenders',
    description: 'Cancel a tender or lot with reasons and authority (BUY-07).',
  },
  // Buyer: opening and evaluation
  'bid.monitor': {
    tenantKind: 'buyer',
    category: 'opening',
    description: 'View submission receipt metadata only; never sealed content (BUY-19, AC-15).',
  },
  'bid.open': {
    tenantKind: 'buyer',
    category: 'opening',
    description: 'Authorize and record the opening of eligible envelopes (BUY-20).',
  },
  'bid.witness': {
    tenantKind: 'buyer',
    category: 'opening',
    description: 'Witness an opening session (BUY-20).',
  },
  'compliance.assess': {
    tenantKind: 'buyer',
    category: 'opening',
    description: 'Record compliance checks and propose exclusions (BUY-21).',
  },
  'exclusion.approve': {
    tenantKind: 'buyer',
    category: 'opening',
    description: 'Approve exclusions within authority (BUY-21, AC-17).',
  },
  'evaluation.chair': {
    tenantKind: 'buyer',
    category: 'evaluation',
    description: 'Assign evaluators, manage conflicts, monitor completion and release the price gate (EVA-01, DD-23).',
  },
  'evaluation.score': {
    tenantKind: 'buyer',
    category: 'evaluation',
    description: 'Score assigned bids and criteria (EVA-02).',
  },
  'evaluation.commercial': {
    tenantKind: 'buyer',
    category: 'evaluation',
    description: 'Perform the commercial comparison after the price gate (EVA-04).',
  },
  'evaluation.moderate': {
    tenantKind: 'buyer',
    category: 'evaluation',
    description: 'Lead moderation and record moderated scores with reasons (EVA-05).',
  },
  'evaluation.signoff': {
    tenantKind: 'buyer',
    category: 'evaluation',
    description: 'Sign off an evaluation report (EVA-06).',
  },
  // Buyer: selection and award
  'selection.manage': {
    tenantKind: 'buyer',
    category: 'selection',
    description: 'Manage demonstrations, references, shortlists and preferred bidders (BUY-22..BUY-24).',
  },
  'shortlist.approve': {
    tenantKind: 'buyer',
    category: 'selection',
    description: 'Approve shortlists and preferred-bidder decisions within authority (BUY-23, BUY-24).',
  },
  'diligence.manage': {
    tenantKind: 'buyer',
    category: 'selection',
    description: 'Run due diligence cases and findings (BUY-24).',
  },
  'negotiation.conduct': {
    tenantKind: 'buyer',
    category: 'selection',
    description: 'Conduct authorized negotiation rounds (BUY-25).',
  },
  'negotiation.approve': {
    tenantKind: 'buyer',
    category: 'selection',
    description: 'Approve negotiation mandates and final-offer rounds (BUY-25, BR-30).',
  },
  'award.recommend': {
    tenantKind: 'buyer',
    category: 'award',
    description: 'Prepare award recommendations and lot outcomes (BUY-26).',
  },
  'award.approve': {
    tenantKind: 'buyer',
    category: 'award',
    description: 'Approve award recommendations and final awards within authority (BUY-26, DD-14).',
  },
  'notice.issue': {
    tenantKind: 'buyer',
    category: 'award',
    description: 'Issue formal notices and track delivery (BUY-15, BUY-28).',
  },
  'complaint.manage': {
    tenantKind: 'buyer',
    category: 'award',
    description: 'Handle complaints, holds and responses (BUY-29).',
  },
  'debrief.manage': {
    tenantKind: 'buyer',
    category: 'award',
    description: 'Provide debriefs to bidders (BUY-28, AC-27).',
  },
  'event.closeout': {
    tenantKind: 'buyer',
    category: 'award',
    description: 'Close out and archive events (BUY-30).',
  },
  // Buyer: contracts
  'contract.view': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'View contracts within assignment and scope (CON-01).',
  },
  'contract.prepare': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'Prepare contracts from awarded lot outcomes and handovers (CON-02, CON-03).',
  },
  'contract.approve': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'Approve contracts and differences from the award (CON-02, AC-28).',
  },
  'contract.sign': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'Sign contracts for the buyer within authority (CON-02).',
  },
  'contract.manage': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'Manage obligations, performance, incidents and closeout (CON-04..CON-11).',
  },
  'contract.change.approve': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'Approve contract changes within authority on the cumulative value (CON-08, AC-31).',
  },
  'contract.renewal.decide': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'Decide renewal, extension or termination options (CON-09, AC-32).',
  },
  'contract.financials.view': {
    tenantKind: 'buyer',
    category: 'contracts',
    description: 'View contract financials: committed, invoiced and paid amounts (CON-07).',
  },
  // Buyer: reporting and records
  'report.view': {
    tenantKind: 'buyer',
    category: 'reporting',
    description: 'View management reports within authorization (REP-01).',
  },
  'report.manage': {
    tenantKind: 'buyer',
    category: 'reporting',
    description: 'Define, share and schedule reports (REP-02, ADM-13).',
  },
  'export.create': {
    tenantKind: 'buyer',
    category: 'reporting',
    description: 'Request controlled exports and evidence packs (ADM-13, ADM-14).',
  },
  'audit.view': {
    tenantKind: 'buyer',
    category: 'records',
    description: 'Read audit trails; restricted rows are redacted to metadata (ADM-14, DD-31).',
  },
  'records.retention.manage': {
    tenantKind: 'buyer',
    category: 'records',
    description: 'Maintain retention classes and schedules (ADM-14).',
  },
  'records.hold.manage': {
    tenantKind: 'buyer',
    category: 'records',
    description: 'Impose and release legal and investigation holds (ADM-14, BR-40).',
  },
  'records.disposal.approve': {
    tenantKind: 'buyer',
    category: 'records',
    description: 'Approve permitted disposal of eligible records (ADM-14, AC-35).',
  },
  'dashboard.view': {
    tenantKind: 'buyer',
    category: 'reporting',
    description: 'View the buyer dashboard, filtered by the viewer’s authorization (BUY-01, DD-23).',
  },
  // Buyer: approvals
  'approval.decide': {
    tenantKind: 'buyer',
    category: 'approvals',
    description: 'Decide assigned approval steps; always combined with the decision-specific permission (COM-05, DD-24).',
  },
  // Supplier
  'supplier.org.manage': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Maintain the supplier organization profile, locations and categories (SUP-03).',
  },
  'supplier.users.manage': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Invite supplier colleagues, approve membership requests and assign responsibilities (SUP-04).',
  },
  'supplier.evidence.manage': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Maintain the reusable evidence library (SUP-05).',
  },
  'supplier.evidence.share': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Share or withdraw evidence with a buyer (SUP-05, FR-02).',
  },
  'supplier.financial.view': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'View the supplier’s own financial evidence (SUP-05).',
  },
  'supplier.opportunities.view': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'View opportunities, invitations and released tender documents (SUP-06..SUP-08).',
  },
  'supplier.pursuit.manage': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Record the private pursuit decision and bid team (SUP-09, DD-41).',
  },
  'supplier.response.edit': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Prepare assigned response sections (SUP-12).',
  },
  'supplier.pricing.edit': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Prepare commercial content and pricing (SUP-13).',
  },
  'supplier.response.approve': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Approve a response revision internally (SUP-14).',
  },
  'supplier.response.submit': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Submit, replace or withdraw a response where authorized (SUP-15, SUP-16, AC-03).',
  },
  'supplier.qualification.apply': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Prepare and submit qualification applications (SUP-20).',
  },
  'supplier.outcomes.view': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'View outcome notices, debriefs and receipts (SUP-17, SUP-19, SUP-21).',
  },
  'supplier.complaint.submit': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Submit and follow complaints (SUP-22).',
  },
  'supplier.contract.participate': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Take part in the supplier side of contracts: signatures, evidence, invoices, reviews (SUP-23).',
  },
  'supplier.notices.acknowledge': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'Acknowledge formal notices and accept their terms for the organization (DD-23, DD-42).',
  },
  'supplier.dashboard.view': {
    tenantKind: 'supplier',
    category: 'supplier',
    description: 'View the supplier dashboard (SUP-01, DD-23).',
  },
  // Operator
  'ops.customers.manage': {
    tenantKind: 'operator',
    category: 'operations',
    description: 'Manage customer organizations, onboarding and offboarding (OPS-01, OPS-02).',
  },
  'ops.subscriptions.manage': {
    tenantKind: 'operator',
    category: 'operations',
    description: 'Manage plans, subscriptions and entitlements (OPS-03).',
  },
  'ops.support.manage': {
    tenantKind: 'operator',
    category: 'operations',
    description: 'Handle support cases and request support access grants (OPS-04).',
  },
  'ops.incidents.manage': {
    tenantKind: 'operator',
    category: 'operations',
    description: 'Manage service incidents and continuity notices (OPS-05).',
  },
  'ops.content.manage': {
    tenantKind: 'operator',
    category: 'operations',
    description: 'Publish product announcements and help content (OPS-07).',
  },
  'ops.oversight.view': {
    tenantKind: 'operator',
    category: 'operations',
    description: 'Review platform oversight metrics without customer procurement content (OPS-06).',
  },
  'support.view': {
    tenantKind: 'operator',
    category: 'operations',
    description:
      'Read-only access inside a customer tenant; granted ONLY by an active support access grant, never by a role (OPS-04).',
  },
} as const satisfies Record<string, PermissionDefinition>;

/** A permission code. */
export type PermissionCode = keyof typeof PERMISSION_CATALOG;

/** Every permission code, in catalog order. */
export const PERMISSION_CODES = Object.keys(PERMISSION_CATALOG) as [PermissionCode, ...PermissionCode[]];

/** zod enum of every permission code. */
export const PermissionCodeSchema = z.enum(PERMISSION_CODES);

/** Type guard for a permission code. */
export function isPermissionCode(value: string): value is PermissionCode {
  return Object.hasOwn(PERMISSION_CATALOG, value);
}

/** The tenant kind of a permission. */
export function permissionTenantKind(code: PermissionCode): PermissionTenantKind {
  return PERMISSION_CATALOG[code].tenantKind;
}

/**
 * Permissions that no role template may contain. `support.view` comes only from an active support access grant,
 * and the operator's effective set inside a customer tenant is then exactly `{support.view}` (ADR 0013).
 */
export const GRANT_ONLY_PERMISSIONS = ['support.view'] as const satisfies readonly PermissionCode[];

/** The effective permission set of an operator acting inside a customer tenant under a support grant. */
export const SUPPORT_GRANT_PERMISSIONS: readonly PermissionCode[] = ['support.view'];

// ---------------------------------------------------------------------------------------------------------
// Role templates
// ---------------------------------------------------------------------------------------------------------

/** Every role template code (blueprint §P). */
export const ROLE_TEMPLATE_CODES = [
  'org_admin',
  'procurement_manager',
  'procurement_officer',
  'requester',
  'budget_owner',
  'qualification_assessor',
  'financial_reviewer',
  'evaluation_chair',
  'evaluator',
  'commercial_reviewer',
  'opening_officer',
  'legal_reviewer',
  'award_approver',
  'contract_manager',
  'auditor',
  'supplier_admin',
  'bid_manager',
  'contributor',
  'commercial_contributor',
  'supplier_approver',
  'authorized_signatory',
  'supplier_finance',
  'platform_operator',
  'support_agent',
] as const;
export const RoleTemplateCode = z.enum(ROLE_TEMPLATE_CODES);
export type RoleTemplateCode = (typeof ROLE_TEMPLATE_CODES)[number];

interface RoleTemplateDefinition {
  readonly tenantKind: Exclude<PermissionTenantKind, 'any'>;
  readonly name: string;
  readonly description: string;
  readonly isSystem: true;
  readonly permissions: readonly PermissionCode[];
}

/** Every `org.*` permission: the whole content of the `org_admin` template. */
const ORG_ADMIN_PERMISSIONS = [
  'org.settings.manage',
  'org.structure.manage',
  'org.users.view',
  'org.users.manage',
  'org.roles.manage',
  'org.access.review',
  'org.authority.manage',
  'org.policy.manage',
  'org.policy.approve',
  'org.templates.manage',
  'org.templates.approve',
  'org.fields.manage',
  'org.calendars.manage',
  'org.portal.manage',
  'org.notifications.manage',
  'org.integrations.manage',
  'org.imports.manage',
  'org.subscription.view',
  'org.support_access.authorize',
] as const satisfies readonly PermissionCode[];

/** The role templates and their permissions (`role_templates` + `role_template_permissions`). */
export const ROLE_TEMPLATES = {
  org_admin: {
    tenantKind: 'buyer',
    name: 'Organization administrator',
    description:
      'Organization settings, users, roles and approved configuration. No tender content, bids, evaluation or financial evidence (PRD §4.1, BR-26).',
    isSystem: true,
    permissions: ORG_ADMIN_PERMISSIONS,
  },
  procurement_manager: {
    tenantKind: 'buyer',
    name: 'Procurement manager',
    description:
      'Approves strategy, releases and process exceptions, supervises workload and authorizes assigned decisions within authority limits.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'request.create',
      'request.view_all',
      'request.review',
      'request.approve',
      'plan.manage',
      'strategy.manage',
      'strategy.approve',
      'supplier.directory.view',
      'supplier.relationship.manage',
      'supplier.duplicates.review',
      'qualification.program.manage',
      'qualification.decide',
      'tender.view',
      'tender.create',
      'tender.edit',
      'tender.release_approve',
      'tender.publish',
      'tender.participants.manage',
      'tender.clarifications.manage',
      'tender.addenda.approve',
      'tender.sessions.manage',
      'tender.close',
      'tender.cancel',
      'bid.monitor',
      'exclusion.approve',
      'selection.manage',
      'shortlist.approve',
      'negotiation.approve',
      'award.recommend',
      'notice.issue',
      'complaint.manage',
      'debrief.manage',
      'event.closeout',
      'contract.view',
      'contract.approve',
      'contract.change.approve',
      'report.view',
      'report.manage',
      'export.create',
      'audit.view',
      'records.retention.manage',
      'records.disposal.approve',
      'approval.decide',
    ],
  },
  procurement_officer: {
    tenantKind: 'buyer',
    name: 'Procurement officer',
    description:
      'Tender owner: runs the event, manages suppliers and communications, coordinates evaluation and recommendation. Cannot approve own release or bypass sealing.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'request.create',
      'request.view_all',
      'request.review',
      'plan.manage',
      'strategy.manage',
      'supplier.directory.view',
      'supplier.relationship.manage',
      'supplier.duplicates.review',
      'tender.view',
      'tender.create',
      'tender.edit',
      'tender.publish',
      'tender.participants.manage',
      'tender.clarifications.manage',
      'tender.sessions.manage',
      'tender.close',
      'bid.monitor',
      'compliance.assess',
      'selection.manage',
      'diligence.manage',
      'negotiation.conduct',
      'award.recommend',
      'notice.issue',
      'debrief.manage',
      'event.closeout',
      'contract.view',
      'contract.prepare',
      'report.view',
      'export.create',
    ],
  },
  requester: {
    tenantKind: 'buyer',
    name: 'Internal requester',
    description: 'Describes needs, answers procurement questions and reviews fulfillment. Cannot publish or award.',
    isSystem: true,
    permissions: ['dashboard.view', 'request.create'],
  },
  budget_owner: {
    tenantKind: 'buyer',
    name: 'Budget owner',
    description:
      'Confirms funding and reviews affordability. Financial review does not imply access to all procurement material.',
    isSystem: true,
    permissions: ['dashboard.view', 'request.view_all', 'request.funding_confirm', 'report.view', 'approval.decide'],
  },
  qualification_assessor: {
    tenantKind: 'buyer',
    name: 'Qualification assessor',
    description: 'Reviews assigned qualification evidence. Cannot alter supplier declarations.',
    isSystem: true,
    permissions: ['dashboard.view', 'supplier.directory.view', 'qualification.review'],
  },
  financial_reviewer: {
    tenantKind: 'buyer',
    name: 'Financial reviewer',
    description: 'Reviews assigned supplier financial evidence only.',
    isSystem: true,
    permissions: ['dashboard.view', 'supplier.directory.view', 'qualification.financial_review'],
  },
  evaluation_chair: {
    tenantKind: 'buyer',
    name: 'Evaluation committee chair',
    description:
      'Assigns evaluators, manages conflicts, monitors completion, releases the price gate and leads moderation. Cannot overwrite submitted scores without a recorded correction.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'tender.view',
      'bid.monitor',
      'compliance.assess',
      'evaluation.chair',
      'evaluation.score',
      'evaluation.moderate',
      'evaluation.signoff',
    ],
  },
  evaluator: {
    tenantKind: 'buyer',
    name: 'Evaluator',
    description: 'Assesses assigned criteria and evidence. No unrelated bids, premature prices or other assessors’ scores.',
    isSystem: true,
    permissions: ['dashboard.view', 'tender.view', 'evaluation.score', 'evaluation.signoff'],
  },
  commercial_reviewer: {
    tenantKind: 'buyer',
    name: 'Commercial reviewer',
    description: 'Performs the commercial comparison, only after the price gate is released.',
    isSystem: true,
    permissions: ['dashboard.view', 'tender.view', 'evaluation.commercial', 'evaluation.signoff'],
  },
  opening_officer: {
    tenantKind: 'buyer',
    name: 'Bid-opening officer',
    description: 'Authorizes, witnesses and records the opening of eligible envelopes. Separate from authoring, evaluation and award.',
    isSystem: true,
    permissions: ['dashboard.view', 'tender.view', 'bid.monitor', 'bid.open', 'bid.witness'],
  },
  legal_reviewer: {
    tenantKind: 'buyer',
    name: 'Legal or compliance reviewer',
    description: 'Reviews terms, procedure, exceptions, challenges and sensitive decisions, by assignment.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'tender.view',
      'complaint.manage',
      'contract.view',
      'contract.approve',
      'audit.view',
      'records.hold.manage',
      'approval.decide',
    ],
  },
  award_approver: {
    tenantKind: 'buyer',
    name: 'Award approver',
    description:
      'Approves, rejects or returns award recommendations and other high-value decisions within delegated authority and without an unresolved conflict.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'request.view_all',
      'request.approve',
      'tender.view',
      'award.approve',
      'contract.view',
      'contract.approve',
      'contract.sign',
      'contract.change.approve',
      'contract.renewal.decide',
      'report.view',
      'approval.decide',
    ],
  },
  contract_manager: {
    tenantKind: 'buyer',
    name: 'Contract manager',
    description:
      'Accepts handover and oversees obligations, changes, performance, renewal and closeout. Cannot rewrite the competition or award history.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'contract.view',
      'contract.prepare',
      'contract.manage',
      'contract.financials.view',
      'report.view',
      'export.create',
    ],
  },
  auditor: {
    tenantKind: 'buyer',
    name: 'Auditor or oversight reviewer',
    description:
      'Read-only business access plus audit trails and controlled evidence exports. Sealed contents stay unavailable before authorized opening.',
    isSystem: true,
    permissions: [
      'dashboard.view',
      'org.users.view',
      'request.view_all',
      'supplier.directory.view',
      'tender.view',
      'bid.monitor',
      'contract.view',
      'contract.financials.view',
      'report.view',
      'audit.view',
      'export.create',
    ],
  },
  supplier_admin: {
    tenantKind: 'supplier',
    name: 'Supplier organization administrator',
    description:
      'Maintains the organization profile, invites members, assigns responsibilities and manages evidence sharing. Cannot grant buyer privileges.',
    isSystem: true,
    permissions: [
      'supplier.dashboard.view',
      'supplier.org.manage',
      'supplier.users.manage',
      'supplier.evidence.manage',
      'supplier.evidence.share',
      'supplier.opportunities.view',
      'supplier.qualification.apply',
      'supplier.outcomes.view',
      'supplier.complaint.submit',
      'supplier.notices.acknowledge',
    ],
  },
  bid_manager: {
    tenantKind: 'supplier',
    name: 'Bid manager',
    description:
      'Decides participation, coordinates responses, assigns work and requests internal approval. Submission authority must be assigned explicitly.',
    isSystem: true,
    permissions: [
      'supplier.dashboard.view',
      'supplier.opportunities.view',
      'supplier.pursuit.manage',
      'supplier.response.edit',
      'supplier.pricing.edit',
      'supplier.qualification.apply',
      'supplier.outcomes.view',
      'supplier.complaint.submit',
      'supplier.notices.acknowledge',
    ],
  },
  contributor: {
    tenantKind: 'supplier',
    name: 'Contributor',
    description: 'Prepares assigned answers and evidence. Cannot submit or grant itself authority (AC-03).',
    isSystem: true,
    permissions: ['supplier.dashboard.view', 'supplier.opportunities.view', 'supplier.response.edit'],
  },
  commercial_contributor: {
    tenantKind: 'supplier',
    name: 'Commercial contributor',
    description: 'Prepares assigned commercial content and pricing.',
    isSystem: true,
    permissions: [
      'supplier.dashboard.view',
      'supplier.opportunities.view',
      'supplier.response.edit',
      'supplier.pricing.edit',
    ],
  },
  supplier_approver: {
    tenantKind: 'supplier',
    name: 'Supplier approver',
    description: 'Approves a response internally, within authority limited by entity, value, tender and dates.',
    isSystem: true,
    permissions: [
      'supplier.dashboard.view',
      'supplier.opportunities.view',
      'supplier.response.approve',
      'supplier.outcomes.view',
      'supplier.notices.acknowledge',
    ],
  },
  authorized_signatory: {
    tenantKind: 'supplier',
    name: 'Authorized signatory',
    description: 'Submits responses where authorized, accepts commitments and signs agreements.',
    isSystem: true,
    permissions: [
      'supplier.dashboard.view',
      'supplier.opportunities.view',
      'supplier.response.approve',
      'supplier.response.submit',
      'supplier.outcomes.view',
      'supplier.contract.participate',
      'supplier.notices.acknowledge',
    ],
  },
  supplier_finance: {
    tenantKind: 'supplier',
    name: 'Supplier finance',
    description: 'Maintains financial evidence and the financial side of contracts.',
    isSystem: true,
    permissions: [
      'supplier.dashboard.view',
      'supplier.financial.view',
      'supplier.evidence.manage',
      'supplier.contract.participate',
    ],
  },
  platform_operator: {
    tenantKind: 'operator',
    name: 'Platform operator',
    description:
      'Manages customer accounts, subscriptions, support, incidents and content. No routine access to customer procurement content.',
    isSystem: true,
    permissions: [
      'ops.customers.manage',
      'ops.subscriptions.manage',
      'ops.support.manage',
      'ops.incidents.manage',
      'ops.content.manage',
      'ops.oversight.view',
    ],
  },
  support_agent: {
    tenantKind: 'operator',
    name: 'Support agent',
    description:
      'Handles support cases and incidents. Enters a customer tenant only under an authorized, time-limited support grant.',
    isSystem: true,
    permissions: ['ops.support.manage', 'ops.incidents.manage', 'ops.content.manage'],
  },
} as const satisfies Record<RoleTemplateCode, RoleTemplateDefinition>;

/** The permissions of one role template. */
export function templatePermissions(code: RoleTemplateCode): readonly PermissionCode[] {
  return ROLE_TEMPLATES[code].permissions;
}

/**
 * The union of the permissions of several templates, in catalog order, without duplicates.
 * The mock API uses it to compute a persona's effective set in one tenant (Stage B adds scopes, grants and
 * restrictions, docs/technical/04-security-model.md §5.3).
 */
export function permissionsForTemplates(codes: readonly RoleTemplateCode[]): PermissionCode[] {
  const granted = new Set<PermissionCode>();
  for (const code of codes) {
    for (const permission of ROLE_TEMPLATES[code].permissions) {
      granted.add(permission);
    }
  }
  return PERMISSION_CODES.filter((code) => granted.has(code));
}

/** The template → permission pairs, in the shape of the `role_template_permissions` seed rows. */
export function roleTemplatePermissionRows(): Array<{ roleCode: RoleTemplateCode; permissionCode: PermissionCode }> {
  return ROLE_TEMPLATE_CODES.flatMap((roleCode) =>
    ROLE_TEMPLATES[roleCode].permissions.map((permissionCode) => ({ roleCode, permissionCode })),
  );
}
