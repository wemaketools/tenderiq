/**
 * Documented alternative oversight for configuration approvals (BR-07, PRD §4.4): policy profile versions (ADM-06),
 * template versions (ADM-08) and portal disclosure settings (ADM-11).
 *
 * Self-approval is blocked whenever another member of the organization holds the approval permission. In each
 * demo buyer the organization administrator is the ONLY holder of `org.policy.approve`, `org.templates.approve`
 * and `org.portal.manage` (role template `org_admin`). BR-07 then allows the administrator to decide their own
 * submission only because the organization documented how a second person oversees it; the note below is shown
 * next to the decision and recorded with it. Without a note, the self-approval stays blocked.
 *
 * Stage B storage: a `sod_policies` row per tenant with the additional rule code `configuration_approval`, mode
 * `alternative_oversight` and `alternative_oversight_note` (blueprint amendment requested by the policy domain;
 * the existing rule codes do not cover configuration approvals).
 */
import { TENANT_IDS } from '../platform.js';

export interface FixtureConfigurationOversight {
  readonly tenantId: number;
  readonly mode: 'alternative_oversight';
  readonly note: string;
  /** The person who performs the oversight, when that person is a TenderIQ user. */
  readonly reviewerUserId: number | null;
  readonly documentedBy: number;
  readonly documentedAt: string;
}

const ADMIN_KWU = 3;
const PULE_AUDITOR = 20;
const ADMIN_ODC = 22;

export const CONFIGURATION_OVERSIGHT: readonly FixtureConfigurationOversight[] = Object.freeze([
  {
    tenantId: TENANT_IDS.kwu,
    mode: 'alternative_oversight',
    note:
      'The Organization Administrator is the only holder of policy, template and portal approval. Internal Audit (Pule Modise) reviews every configuration change the administrator both submits and approves within five working days and files the review with the audit log.',
    reviewerUserId: PULE_AUDITOR,
    documentedBy: ADMIN_KWU,
    documentedAt: '2025-11-03T07:30:00Z',
  },
  {
    tenantId: TENANT_IDS.odc,
    mode: 'alternative_oversight',
    note:
      'The Organization Administrator is the only holder of policy, template and portal approval. The Council Secretary reviews and countersigns every configuration change the administrator both submits and approves.',
    reviewerUserId: null,
    documentedBy: ADMIN_ODC,
    documentedAt: '2026-01-12T07:30:00Z',
  },
]);
