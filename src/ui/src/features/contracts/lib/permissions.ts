/**
 * Permission requirements of the contract screens; they mirror the `permission` of the contract endpoints
 * (`src/contracts/contracts.ts`). Hiding an action is a convenience: the API enforces every permission.
 */
import type { PermissionRequirement } from '../../../app/featureRegistry';

export const CONTRACT_VIEW: PermissionRequirement = 'contract.view';
export const CONTRACT_PREPARE: PermissionRequirement = 'contract.prepare';
export const CONTRACT_APPROVE: PermissionRequirement = 'contract.approve';
export const CONTRACT_SIGN: PermissionRequirement = 'contract.sign';
export const CONTRACT_MANAGE: PermissionRequirement = 'contract.manage';
export const CONTRACT_CHANGE_APPROVE: PermissionRequirement = 'contract.change.approve';
export const CONTRACT_RENEWAL_DECIDE: PermissionRequirement = 'contract.renewal.decide';
export const CONTRACT_FINANCIALS: PermissionRequirement = 'contract.financials.view';
/** Owner assignment and commencement accept either capacity. */
export const CONTRACT_MANAGE_OR_PREPARE: PermissionRequirement = [
  'contract.manage',
  'contract.prepare',
];

/** SUP-23 reading: participants and members who follow outcomes. */
export const SUPPLIER_CONTRACT_READ: PermissionRequirement = [
  'supplier.contract.participate',
  'supplier.outcomes.view',
];
/** SUP-23 commands. */
export const SUPPLIER_CONTRACT_PARTICIPATE: PermissionRequirement = 'supplier.contract.participate';
