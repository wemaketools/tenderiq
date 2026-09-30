/**
 * The permission requirements of the selection screens. They mirror the contract (`@contracts/selection`), so the
 * sidebar, the route guards and the action buttons agree with what the API enforces.
 */
import {
  ASSESSMENT_VIEW_PERMISSIONS,
  DILIGENCE_DECIDE_PERMISSIONS,
  FINDING_RECORD_PERMISSIONS,
  SELECTION_VIEW_PERMISSIONS,
  SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS,
  SUPPLIER_ROUND_RESPOND_PERMISSIONS,
} from '@contracts/selection';

import type { PermissionRequirement } from '../../../app/featureRegistry';

/** Reads the selection register, shortlists, preferred bidders, diligence and negotiations. */
export const SELECTION_READ: PermissionRequirement = SELECTION_VIEW_PERMISSIONS;
/** Reads assessment sessions and reference checks (also the evaluation panel). */
export const ASSESSMENT_READ: PermissionRequirement = ASSESSMENT_VIEW_PERMISSIONS;
/** Plans sessions, shortlists, recommends preferred bidders and requests final offers. */
export const SELECTION_MANAGE: PermissionRequirement = 'selection.manage';
/** Records an assessment finding (organizer or assigned assessor). */
export const FINDING_RECORD: PermissionRequirement = FINDING_RECORD_PERMISSIONS;
/** Records diligence findings and evidence requests. */
export const DILIGENCE_MANAGE: PermissionRequirement = 'diligence.manage';
/** Decides a diligence case. */
export const DILIGENCE_DECIDE: PermissionRequirement = DILIGENCE_DECIDE_PERMISSIONS;
/** Opens negotiations and records rounds. */
export const NEGOTIATION_CONDUCT: PermissionRequirement = 'negotiation.conduct';
/** Proposes a process decision (the organizer or the negotiation lead). */
export const PROCESS_DECISION_PROPOSE: PermissionRequirement = [
  'selection.manage',
  'negotiation.conduct',
];
/** Supplier: reads its assessment appointments (SUP-18). */
export const SUPPLIER_INVITES_READ: PermissionRequirement = 'supplier.opportunities.view';
/** Supplier: confirms or declines an appointment. */
export const SUPPLIER_INVITES_RESPOND: PermissionRequirement = 'supplier.notices.acknowledge';
/** Supplier: reads its own negotiation and final-offer rounds (SUP-19). */
export const SUPPLIER_NEGOTIATION_READ: PermissionRequirement =
  SUPPLIER_NEGOTIATION_VIEW_PERMISSIONS;
/** Supplier: sends an internally approved round response. */
export const SUPPLIER_ROUND_RESPOND: PermissionRequirement = SUPPLIER_ROUND_RESPOND_PERMISSIONS;
