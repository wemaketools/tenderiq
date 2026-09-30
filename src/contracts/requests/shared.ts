/**
 * Requests domain (05): shared references and rules used by the request, planning, strategy and public contracts
 * (PRD FR-04, FR-05, §8.1, BR-06, BR-10; blueprint Migration 06 `requests_planning`).
 *
 * Pure module: zod and sibling contract files only.
 */
import { z } from 'zod';

import { Id, LinkPath, Reference, Slug } from '../common.js';
import type { PermissionCode } from '../permissions.js';
import {
  AdvanceNoticesStatus,
  PlanItemsStatus,
  ProcurementRequestsStatus,
  ProcurementStrategiesProcedure,
  ProcurementStrategiesStatus,
  TendersStatus,
} from '../enums.js';
import type { ProcurementRequestsStatus as RequestStatus } from '../enums.js';

// ---------------------------------------------------------------------------------------------------------
// References to records shown on requests, plan items and strategies
// ---------------------------------------------------------------------------------------------------------

/** A named organization-structure record (`legal_entities`, `cost_centers`, `funding_sources`). */
export const NamedRef = z.object({
  id: Id,
  name: z.string().min(1),
});
export type NamedRef = z.infer<typeof NamedRef>;

/** A coded record (`departments`, `categories`, `cost_centers`, `funding_sources`). */
export const CodedRef = z.object({
  id: Id,
  code: z.string().min(1),
  name: z.string().min(1),
});
export type CodedRef = z.infer<typeof CodedRef>;

/** A procurement project (`procurement_projects`, reference `PP-YYYY-NNNN`, DD-09). */
export const ProjectRef = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
});
export type ProjectRef = z.infer<typeof ProjectRef>;

/** A procurement request (`procurement_requests`, reference `PR-YYYY-NNNN`). */
export const RequestRef = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  status: ProcurementRequestsStatus,
});
export type RequestRef = z.infer<typeof RequestRef>;

/** A contract of the same buyer (`contracts`, reference `C-YYYY-NNNN`). */
export const ContractRef = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
});
export type ContractRef = z.infer<typeof ContractRef>;

/** A tender of the same buyer (`tenders`, reference `T-YYYY-NNNN`). */
export const TenderRef = z.object({
  id: Id,
  reference: Reference,
  title: z.string().min(1),
  status: TendersStatus,
});
export type TenderRef = z.infer<typeof TenderRef>;

/** A supplier organization named on market research or a fairness review. */
export const SupplierRef = z.object({
  tenantId: Id,
  name: z.string().min(1),
});
export type SupplierRef = z.infer<typeof SupplierRef>;

/** A plan item reference (`plan_items`). */
export const PlanItemRef = z.object({
  id: Id,
  title: z.string().min(1),
  status: PlanItemsStatus,
});
export type PlanItemRef = z.infer<typeof PlanItemRef>;

/** An advance notice reference (`advance_notices`). */
export const AdvanceNoticeRef = z.object({
  id: Id,
  title: z.string().min(1),
  status: AdvanceNoticesStatus,
});
export type AdvanceNoticeRef = z.infer<typeof AdvanceNoticeRef>;

/** A strategy reference (`procurement_strategies`). */
export const StrategyRef = z.object({
  id: Id,
  revision: z.number().int().min(1),
  procedure: ProcurementStrategiesProcedure,
  status: ProcurementStrategiesStatus,
});
export type StrategyRef = z.infer<typeof StrategyRef>;

/** A public buyer identity (portal pages carry the buyer slug, DD-22). */
export const PublicBuyer = z.object({
  slug: Slug,
  name: z.string().min(1),
});
export type PublicBuyer = z.infer<typeof PublicBuyer>;

/** One readiness line (submission of a request, publication of a notice, submission of a strategy). */
export const READINESS_STATUSES = ['passed', 'warning', 'blocking'] as const;
export const ReadinessStatus = z.enum(READINESS_STATUSES);
export type ReadinessStatus = z.infer<typeof ReadinessStatus>;

export const ReadinessItem = z.object({
  /** Stable id of the check (usually the field it concerns), for example `estimatedValue`. */
  id: z.string().min(1),
  label: z.string().min(1),
  status: ReadinessStatus,
  detail: z.string().nullable(),
});
export type ReadinessItem = z.infer<typeof ReadinessItem>;

/** A link to another screen offered next to a record (for example "Create tender"). */
export const ActionLink = z.object({
  label: z.string().min(1),
  path: LinkPath,
});
export type ActionLink = z.infer<typeof ActionLink>;

// ---------------------------------------------------------------------------------------------------------
// Request lifecycle (PRD §8.1)
// ---------------------------------------------------------------------------------------------------------

/**
 * Permitted status transitions of a procurement request (PRD §8.1). PRD "abandoned" is `withdrawn`. `closed` also
 * records a request combined into another one (`combined_into_id` set, originals preserved, FR-04).
 * A material change to an `approved` request returns it to `under_review` (BR-10).
 */
export const REQUEST_TRANSITIONS = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under_review', 'information_requested', 'approved', 'rejected', 'deferred', 'withdrawn', 'closed', 'routed_to_existing'],
  under_review: ['information_requested', 'approved', 'rejected', 'deferred', 'withdrawn', 'closed', 'routed_to_existing'],
  information_requested: ['submitted', 'withdrawn'],
  approved: ['converted', 'routed_to_existing', 'rescinded', 'under_review'],
  rejected: ['closed', 'under_review'],
  withdrawn: ['closed', 'under_review'],
  deferred: ['closed', 'under_review'],
  converted: [],
  routed_to_existing: [],
  rescinded: [],
  closed: [],
} as const satisfies Record<RequestStatus, readonly RequestStatus[]>;

/** Whether a request may move from one status to another (PRD §8.1). */
export function canTransitionRequest(from: RequestStatus, to: RequestStatus): boolean {
  return (REQUEST_TRANSITIONS[from] as readonly RequestStatus[]).includes(to);
}

/** Statuses after which a request no longer changes. */
export const REQUEST_TERMINAL_STATUSES = ['converted', 'routed_to_existing', 'rescinded', 'closed'] as const satisfies readonly RequestStatus[];

/**
 * Business-case fields whose change after approval is material (FR-04 "material scope, amount, funding, risk or
 * contracting entity"; BR-10): changing one invalidates the approval and requires re-approval.
 */
export const REQUEST_MATERIAL_FIELDS = [
  'scopeDescription',
  'quantities',
  'estimatedValue',
  'estimatedTotalCommitment',
  'contractTermMonths',
  'renewalOptions',
  'fundingSourceId',
  'fundingStatus',
  'legalEntityId',
  'risks',
] as const;
export type RequestMaterialField = (typeof REQUEST_MATERIAL_FIELDS)[number];

/** Actions a caller may take on a request, computed per status, relationship and permission. */
export const REQUEST_ACTIONS = [
  'edit',
  'submit',
  'withdraw',
  'respond_info',
  'request_info',
  'assign',
  'combine',
  'split',
  'defer',
  'decide',
  'escalate',
  'confirm_funding',
  'comment',
  'route_to_contract',
  'rescind',
  'reconsider',
  'close',
  'create_tender',
  'create_strategy',
] as const;
export const RequestAction = z.enum(REQUEST_ACTIONS);
export type RequestAction = z.infer<typeof RequestAction>;

/** The permission each request action needs (the API re-checks status and relationship). */
export const REQUEST_ACTION_PERMISSIONS = {
  edit: 'request.create',
  submit: 'request.create',
  withdraw: 'request.create',
  respond_info: 'request.create',
  request_info: 'request.review',
  assign: 'request.review',
  combine: 'request.review',
  split: 'request.review',
  defer: 'request.review',
  decide: 'request.approve',
  escalate: 'request.approve',
  confirm_funding: 'request.funding_confirm',
  comment: 'request.review',
  route_to_contract: 'request.review',
  rescind: 'request.approve',
  reconsider: 'request.review',
  close: 'request.review',
  create_tender: 'tender.create',
  create_strategy: 'strategy.manage',
} as const satisfies Record<RequestAction, PermissionCode>;

/** Statuses in which each request action is offered (PRD §8.1). */
export const REQUEST_ACTION_STATUSES = {
  edit: ['draft', 'submitted', 'under_review', 'information_requested', 'approved'],
  submit: ['draft', 'information_requested'],
  withdraw: ['draft', 'submitted', 'under_review', 'information_requested'],
  respond_info: ['information_requested'],
  request_info: ['submitted', 'under_review'],
  assign: ['submitted', 'under_review', 'information_requested', 'approved'],
  combine: ['submitted', 'under_review'],
  split: ['submitted', 'under_review'],
  defer: ['submitted', 'under_review'],
  decide: ['submitted', 'under_review'],
  escalate: ['submitted', 'under_review'],
  confirm_funding: ['submitted', 'under_review', 'information_requested', 'approved'],
  comment: ['submitted', 'under_review', 'information_requested', 'approved', 'deferred'],
  route_to_contract: ['submitted', 'under_review', 'approved'],
  rescind: ['approved'],
  reconsider: ['rejected', 'withdrawn', 'deferred'],
  close: ['rejected', 'withdrawn', 'deferred'],
  create_tender: ['approved'],
  create_strategy: ['approved'],
} as const satisfies Record<RequestAction, readonly RequestStatus[]>;

/** The SPA route that starts a tender from an approved request (BUY-07). */
export function createTenderPath(requestId: number): string {
  return `/buyer/tenders/new?fromRequest=${requestId}`;
}

// ---------------------------------------------------------------------------------------------------------
// Strategy actions (BUY-06)
// ---------------------------------------------------------------------------------------------------------

export const STRATEGY_ACTIONS = [
  'edit',
  'add_research',
  'decide_fairness',
  'submit',
  'decide',
  'create_tender',
] as const;
export const StrategyAction = z.enum(STRATEGY_ACTIONS);
export type StrategyAction = z.infer<typeof StrategyAction>;

export const STRATEGY_ACTION_PERMISSIONS = {
  edit: 'strategy.manage',
  add_research: 'strategy.manage',
  decide_fairness: 'strategy.approve',
  submit: 'strategy.manage',
  decide: 'strategy.approve',
  create_tender: 'tender.create',
} as const satisfies Record<StrategyAction, PermissionCode>;

// ---------------------------------------------------------------------------------------------------------
// Permission sets
// ---------------------------------------------------------------------------------------------------------

/** Reading requests: own requests (`request.create`) or every request in scope (`request.view_all`). */
export const REQUEST_READ = ['request.create', 'request.view_all'] as const satisfies readonly PermissionCode[];
/** Reading the procurement plan and advance notices (BUY-05). */
export const PLAN_READ = ['plan.manage', 'request.view_all'] as const satisfies readonly PermissionCode[];
/** Reading strategies and market research (BUY-06): internal deliberations, by assignment (PRD §4.3). */
export const STRATEGY_READ = ['strategy.manage', 'strategy.approve', 'audit.view'] as const satisfies readonly PermissionCode[];
/** The shared form options (organization structure, people, projects, suppliers). */
export const OPTIONS_READ = [
  'request.create',
  'request.view_all',
  'plan.manage',
  'strategy.manage',
] as const satisfies readonly PermissionCode[];
