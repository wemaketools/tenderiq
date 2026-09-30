/**
 * Requests domain handlers (05): shared lookups and projections over the fixtures (references, people,
 * authority checks, sorting). Pure functions; nothing is persisted.
 */
import { createHash } from 'node:crypto';

import type { AuthorityCheck, EligibleApprover } from '../../../contracts/approvals.js';
import type { ActorRef, Money, PersonRef } from '../../../contracts/common.js';
import { add, compare, gte, round } from '../../../contracts/decimal.js';
import type { AuthorityLimitsDecisionType } from '../../../contracts/enums.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { CodedRef, ContractRef, NamedRef, ProjectRef, RequestRef, SupplierRef, TenderRef } from '../../../contracts/requests.js';
import {
  CATEGORIES,
  CONTRACTS,
  COST_CENTERS,
  DEPARTMENTS,
  FUNDING_SOURCES,
  LEGAL_ENTITIES,
  PROJECTS,
  REQUESTS,
  TENDERS,
} from '../../fixtures/requests/index.js';
import type { FixtureRequest } from '../../fixtures/requests/index.js';
import { PERSONAS } from '../../fixtures/platform.js';
import { findTenantById, membershipPermissions, personRef } from '../../persona.js';

// ---------------------------------------------------------------------------------------------------------
// References (always scoped to the tenant: another tenant's id resolves to null)
// ---------------------------------------------------------------------------------------------------------

export function legalEntityRef(tenantId: number, id: number | null): NamedRef | null {
  const row = LEGAL_ENTITIES.find((entity) => entity.id === id && entity.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, name: row.name };
}

export function departmentRef(tenantId: number, id: number | null): CodedRef | null {
  const row = DEPARTMENTS.find((department) => department.id === id && department.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, code: row.code, name: row.name };
}

export function categoryRef(tenantId: number, id: number | null): CodedRef | null {
  const row = CATEGORIES.find((category) => category.id === id && category.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, code: row.code, name: row.name };
}

export function costCenterRef(tenantId: number, id: number | null): CodedRef | null {
  const row = COST_CENTERS.find((center) => center.id === id && center.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, code: row.code, name: row.name };
}

export function fundingSourceRef(tenantId: number, id: number | null): CodedRef | null {
  const row = FUNDING_SOURCES.find((source) => source.id === id && source.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, code: row.code, name: row.name };
}

export function projectRef(tenantId: number, id: number | null): ProjectRef | null {
  const row = PROJECTS.find((project) => project.id === id && project.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, reference: row.reference, title: row.title };
}

export function contractRef(tenantId: number, id: number | null): ContractRef | null {
  const row = CONTRACTS.find((contract) => contract.id === id && contract.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, reference: row.reference, title: row.title };
}

export function tenderRef(tenantId: number, id: number | null): TenderRef | null {
  const row = TENDERS.find((tender) => tender.id === id && tender.tenantId === tenantId);
  return row === undefined ? null : { id: row.id, reference: row.reference, title: row.title, status: row.status };
}

export function requestRefOf(row: FixtureRequest): RequestRef {
  return { id: row.id, reference: row.reference, title: row.title, status: row.status };
}

export function requestRef(tenantId: number, id: number | null): RequestRef | null {
  const row = REQUESTS.find((request) => request.id === id && request.tenantId === tenantId);
  return row === undefined ? null : requestRefOf(row);
}

export function supplierRef(tenantId: number | null): SupplierRef | null {
  if (tenantId === null) {
    return null;
  }
  const tenant = findTenantById(tenantId);
  return tenant === undefined || tenant.kind !== 'supplier' ? null : { tenantId: tenant.id, name: tenant.name };
}

export function personOrNull(userId: number | null): PersonRef | null {
  return userId === null ? null : personRef(userId);
}

/** A person with the capacity they hold in the tenant (BR-02). */
export function actorRef(tenantId: number, userId: number): ActorRef {
  const persona = PERSONAS.find((candidate) => candidate.userId === userId);
  const membership = persona?.memberships.find((candidate) => candidate.tenantId === tenantId);
  return { ...personRef(userId), capacity: membership?.capacity ?? null };
}

// ---------------------------------------------------------------------------------------------------------
// People of a tenant
// ---------------------------------------------------------------------------------------------------------

export interface TenantPerson {
  readonly userId: number;
  readonly fullName: string;
  readonly capacity: string | null;
  readonly permissions: readonly PermissionCode[];
  readonly authorityLimit: Money | null;
}

/** Active persons with an active membership in the tenant, with their effective permissions there. */
export function tenantPeople(tenantId: number): TenantPerson[] {
  const people: TenantPerson[] = [];
  for (const persona of PERSONAS) {
    if (persona.status !== 'active') {
      continue;
    }
    const membership = persona.memberships.find((candidate) => candidate.tenantId === tenantId && candidate.status === 'active');
    if (membership === undefined) {
      continue;
    }
    people.push({
      userId: persona.userId,
      fullName: persona.fullName,
      capacity: membership.capacity,
      permissions: membershipPermissions(membership),
      authorityLimit: membership.authorityLimit,
    });
  }
  return people;
}

export function hasPermission(person: TenantPerson | undefined, code: PermissionCode): boolean {
  return person?.permissions.includes(code) ?? false;
}

// ---------------------------------------------------------------------------------------------------------
// Authority (BR-06, DD-24)
// ---------------------------------------------------------------------------------------------------------

/** The authority check of one person for one decision type and amount (same currency; no conversion here). */
export function authorityCheck(
  limit: Money | null,
  decisionType: AuthorityLimitsDecisionType,
  amount: Money | null,
): AuthorityCheck {
  const sufficient =
    limit !== null && (amount === null || (limit.currency === amount.currency && gte(limit.amount, amount.amount)));
  return {
    decisionType,
    amount,
    sufficient,
    basis: limit === null ? 'none' : 'authority_limit',
    limit,
    delegatedFrom: null,
    conversion: null,
    missingExchangeRate: false,
    routedToNextLevel: limit !== null && !sufficient,
  };
}

export interface ApproverRoute {
  readonly eligible: EligibleApprover[];
  readonly skipped: EligibleApprover | null;
  readonly routedToNextLevel: boolean;
}

/**
 * The deciders of a tenant who hold `approval.decide` and the decision permission, ordered by limit. `eligible`
 * lists those whose authority covers the amount (lowest first); `skipped` is the lowest level that lacks it (AC-05).
 */
export function approverRoute(
  tenantId: number,
  decisionPermission: PermissionCode,
  decisionType: AuthorityLimitsDecisionType,
  amount: Money | null,
): ApproverRoute {
  const deciders = tenantPeople(tenantId)
    .filter((person) => hasPermission(person, 'approval.decide') && hasPermission(person, decisionPermission) && person.authorityLimit !== null)
    .sort((left, right) => compare(left.authorityLimit?.amount ?? '0', right.authorityLimit?.amount ?? '0'));
  const checked = deciders.map(
    (person): EligibleApprover => ({
      userId: person.userId,
      fullName: person.fullName,
      capacity: person.capacity,
      check: authorityCheck(person.authorityLimit, decisionType, amount),
    }),
  );
  const eligible = checked.filter((approver) => approver.check.sufficient);
  const lowest = checked[0] ?? null;
  const skipped = lowest !== null && !lowest.check.sufficient && eligible.length > 0 ? lowest : null;
  return { eligible, skipped, routedToNextLevel: skipped !== null };
}

// ---------------------------------------------------------------------------------------------------------
// Values, hashes, dates, sorting
// ---------------------------------------------------------------------------------------------------------

/** Sums amounts of one currency; `null` when the list is empty or currencies differ. */
export function sumMoney(values: readonly Money[]): Money | null {
  const [first, ...rest] = values;
  if (first === undefined || rest.some((value) => value.currency !== first.currency)) {
    return null;
  }
  return { amount: round(rest.reduce((total, value) => add(total, value.amount), first.amount), 2), currency: first.currency };
}

/** A stable SHA-256 content hash of a subject version (what an approval binds to, BR-10). */
export function contentHash(subject: string, id: number, revision: number): string {
  return createHash('sha256').update(`${subject}:${id}:${revision}`).digest('hex');
}

const DAY_MS = 86_400_000;

/** Whole days between two instants (never negative). */
export function daysBetween(fromIso: string, to: Date): number {
  return Math.max(0, Math.floor((to.getTime() - Date.parse(fromIso)) / DAY_MS));
}

/** The calendar date (`YYYY-MM-DD`) of an instant in a time zone. */
export function dateInZone(instant: string | Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(
    typeof instant === 'string' ? new Date(instant) : instant,
  );
  const part = (type: string): string => parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export type SortValue = string | number | Money | null;

/** Sorts rows by a key; `null` values last in both directions; money by decimal value; ties by `id`. */
export function sortRows<T extends { readonly id: number }>(
  rows: readonly T[],
  key: ((row: T) => SortValue) | null,
  dir: 'asc' | 'desc',
): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return [...rows].sort((left, right) => {
    if (key === null) {
      return left.id - right.id;
    }
    const a = key(left);
    const b = key(right);
    if (a === null || b === null) {
      return a === b ? left.id - right.id : a === null ? 1 : -1;
    }
    let result: number;
    if (typeof a === 'object' && typeof b === 'object') {
      result = compare(a.amount, b.amount);
    } else if (typeof a === 'number' && typeof b === 'number') {
      result = a - b;
    } else {
      result = String(a).localeCompare(String(b));
    }
    return result === 0 ? left.id - right.id : result * factor;
  });
}

/** Case-insensitive search over several text fields. */
export function matchesSearch(q: string | undefined, fields: readonly (string | null | undefined)[]): boolean {
  if (q === undefined || q === '') {
    return true;
  }
  const needle = q.toLowerCase();
  return fields.some((field) => field !== null && field !== undefined && field.toLowerCase().includes(needle));
}

/** The official time zone of a tenant. */
export function tenantTimeZone(tenantId: number): string {
  return findTenantById(tenantId)?.officialTimeZone ?? 'Africa/Gaborone';
}

/** The next id for a record a static command "creates" (ids ≥ 900, foundation-contract §2.3). */
export const NEW_ID = 900;
