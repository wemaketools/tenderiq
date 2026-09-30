/**
 * Helpers shared by the suppliers handlers: clock and date arithmetic, person and organization references, evidence
 * freshness, sorting and text search. Pure functions over the static fixtures.
 */
import type { OrganizationLabel, PersonRef } from '../../../contracts/common.js';
import type { PermissionCode } from '../../../contracts/permissions.js';
import type { EvidenceFreshness, SupplierCategory } from '../../../contracts/suppliers.js';
import { EVIDENCE_EXPIRY_WARNING_DAYS } from '../../../contracts/suppliers.js';
import { findCategory } from '../../fixtures/suppliers/catalog.js';
import { findExternalPerson, findSupplierOrg } from '../../fixtures/suppliers/organizations.js';
import { PERSONAS, TENANTS } from '../../fixtures/platform.js';

/** An instant without milliseconds (`2026-10-01T08:00:00Z`). */
export function instantOf(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** The UTC calendar date of an instant (`YYYY-MM-DD`). */
export function dateOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Adds whole days to a `YYYY-MM-DD` date. */
export function addDays(date: string, days: number): string {
  const time = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(time).toISOString().slice(0, 10);
}

/** The instant of local midnight of `date` in an IANA zone (effective dates of identity changes). */
export function zonedMidnight(date: string, timeZone: string): string {
  const utcMidnight = new Date(`${date}T00:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(utcMidnight);
  const offset = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT';
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset);
  const minutes = match === null ? 0 : (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3]));
  return instantOf(new Date(utcMidnight.getTime() - minutes * 60_000));
}

/** Freshness of an edition at `now` (EVIDENCE_EXPIRY_WARNING_DAYS window). */
export function freshnessOf(expiresAt: string | null, now: Date): EvidenceFreshness {
  if (expiresAt === null) {
    return 'no_expiry';
  }
  const today = dateOf(now);
  if (expiresAt < today) {
    return 'expired';
  }
  if (expiresAt <= addDays(today, EVIDENCE_EXPIRY_WARNING_DAYS)) {
    return 'expiring_soon';
  }
  return 'current';
}

const FRESHNESS_SEVERITY: Readonly<Record<EvidenceFreshness, number>> = {
  no_expiry: 0,
  current: 1,
  expiring_soon: 2,
  expired: 3,
};

/** The most severe freshness of a set, or `null` for an empty set. */
export function worstFreshness(values: readonly EvidenceFreshness[]): EvidenceFreshness | null {
  let worst: EvidenceFreshness | null = null;
  for (const value of values) {
    if (worst === null || FRESHNESS_SEVERITY[value] > FRESHNESS_SEVERITY[worst]) {
      worst = value;
    }
  }
  return worst;
}

/** A person reference for a persona or a non-persona user of the story. */
export function personOf(userId: number): PersonRef {
  const persona = PERSONAS.find((candidate) => candidate.userId === userId);
  if (persona !== undefined) {
    return { userId, fullName: persona.fullName };
  }
  const external = findExternalPerson(userId);
  if (external !== undefined) {
    return { userId, fullName: external.fullName };
  }
  throw new Error(`No person with user id ${userId}.`);
}

/** The e-mail of a persona or non-persona user. */
export function emailOf(userId: number): string {
  const persona = PERSONAS.find((candidate) => candidate.userId === userId);
  if (persona !== undefined) {
    return persona.email;
  }
  const external = findExternalPerson(userId);
  if (external !== undefined) {
    return external.email;
  }
  throw new Error(`No person with user id ${userId}.`);
}

/** True when a persona holds an ACTIVE membership in the tenant. */
export function isActiveMember(userId: number, tenantId: number): boolean {
  const persona = PERSONAS.find((candidate) => candidate.userId === userId);
  return (
    persona !== undefined &&
    persona.status === 'active' &&
    persona.memberships.some((membership) => membership.tenantId === tenantId && membership.status === 'active')
  );
}

/** Active members of a tenant (personas with an active membership), by name: owner and contact choices. */
export function activeMembersOf(tenantId: number): PersonRef[] {
  return PERSONAS.filter((persona) => isActiveMember(persona.userId, tenantId))
    .map((persona) => ({ userId: persona.userId, fullName: persona.fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

/** Organization label of any tenant: platform tenants by name, record-only supplier tenants by legal name. */
export function orgLabel(tenantId: number): OrganizationLabel {
  const tenant = TENANTS.find((candidate) => candidate.id === tenantId);
  if (tenant !== undefined) {
    return { tenantId, tenantName: tenant.name, tenantKind: tenant.kind };
  }
  const org = findSupplierOrg(tenantId);
  if (org !== undefined) {
    return { tenantId, tenantName: org.tradingName ?? org.legalName, tenantKind: 'supplier' };
  }
  throw new Error(`No tenant with id ${tenantId}.`);
}

/** Catalog categories for a list of codes (unknown codes are skipped). */
export function categoriesOf(codes: readonly string[]): SupplierCategory[] {
  return codes.flatMap((code) => {
    const category = findCategory(code);
    return category === undefined ? [] : [{ catalogCode: category.code, name: category.name, parentCode: category.parentCode }];
  });
}

/** True when the free-text query matches any of the fields (case-insensitive). */
export function matchesQuery(q: string | undefined, ...fields: readonly (string | null | undefined)[]): boolean {
  if (q === undefined || q.trim() === '') {
    return true;
  }
  const needle = q.trim().toLowerCase();
  return fields.some((field) => field !== null && field !== undefined && field.toLowerCase().includes(needle));
}

/** True when `value` (an instant or date) falls within the optional inclusive date range. */
export function withinDates(value: string | null, from: string | undefined, to: string | undefined): boolean {
  if (from === undefined && to === undefined) {
    return true;
  }
  if (value === null) {
    return false;
  }
  const day = value.slice(0, 10);
  return (from === undefined || day >= from) && (to === undefined || day <= to);
}

type SortValue = string | number | null;

/** Sorts a copy by a key; nulls last in either direction; ties keep fixture order. */
export function sortBy<T>(rows: readonly T[], key: (row: T) => SortValue, dir: 'asc' | 'desc'): T[] {
  const factor = dir === 'desc' ? -1 : 1;
  return rows
    .map((row, index) => ({ row, index, value: key(row) }))
    .sort((a, b) => {
      if (a.value === b.value) {
        return a.index - b.index;
      }
      if (a.value === null) {
        return 1;
      }
      if (b.value === null) {
        return -1;
      }
      return (a.value < b.value ? -1 : 1) * factor;
    })
    .map((entry) => entry.row);
}

/** True when any of the codes is held. */
export function holds(permissions: readonly PermissionCode[], code: PermissionCode): boolean {
  return permissions.includes(code);
}

/** Normalizes an organization name for duplicate matching (legal suffixes and punctuation removed). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\((pty)\)|\bpty\b|\bltd\b|\blimited\b|\bco\b\.?|\bcompany\b|\bservices\b|\bsupplies\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
