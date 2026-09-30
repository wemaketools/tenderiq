/**
 * Labels and chip tones of the operations enumerations the contract defines itself (they are not in
 * `src/contracts/enums.ts` yet): severity, plan, invoice, service action, onboarding item, access review, conduct case,
 * support case category and grant scope wording. Blueprint enumerations use `StatusChip` directly. Shared by the
 * operator area, the buyer service screens (admin-integrations) and the help centre.
 */
import type { ChipTone } from '@contracts/enums';

import { t } from '../../../lib/i18n';

export const OPS_TONES = {
  severity: { low: 'neutral', medium: 'info', high: 'warning', critical: 'danger' },
  plan: { pilot: 'accent', buyer_standard: 'info', buyer_enterprise: 'success' },
  invoice: {
    issued: 'info',
    paid: 'success',
    overdue: 'danger',
    disputed: 'warning',
    void: 'neutral-outlined',
  },
  serviceAction: { open: 'warning', in_progress: 'info', resolved: 'success' },
  itemStatus: {
    open: 'neutral',
    in_progress: 'info',
    done: 'success',
    blocked: 'danger',
    not_applicable: 'neutral-outlined',
  },
  itemArea: { setup: 'info', ownership: 'accent', adoption: 'success', issue: 'warning' },
  reviewStatus: { due: 'warning', overdue: 'danger', completed: 'success' },
  reviewOutcome: { retain: 'success', reduce: 'warning', revoke: 'danger' },
  conductKind: { service_complaint: 'info', misuse: 'danger' },
  conductStatus: { open: 'warning', under_review: 'info', closed: 'neutral' },
  noticeKind: { announcement: 'accent', incident: 'warning' },
  readiness: { blocking: 'danger', warning: 'warning', passed: 'success' },
  feature: {
    named_users: 'neutral',
    legal_entities: 'neutral',
    published_events_per_year: 'neutral',
    active_contracts: 'neutral',
    storage_gb: 'neutral',
    integrations: 'neutral',
    reporting_pack: 'neutral',
    onboarding_days: 'neutral',
  },
  accommodation: {
    screen_reader_document: 'info',
    large_print: 'info',
    sign_language_interpreter: 'info',
    extended_session_time: 'info',
    assisted_site_access: 'info',
    other: 'neutral',
  },
} as const satisfies Record<string, Record<string, ChipTone>>;

export type OpsChipKind = keyof typeof OPS_TONES;

/** The label of a contract-defined value: `ops.enum.<kind>.<value>`. */
export function opsLabel(kind: OpsChipKind, value: string): string {
  return t(`ops.enum.${kind}.${value}`);
}

/** Select options for a contract-defined enumeration. */
export function opsOptions(
  kind: OpsChipKind,
  values: readonly string[],
): { value: string; label: string }[] {
  return values.map((value) => ({ value, label: opsLabel(kind, value) }));
}

/** A person's name, or the "not assigned" text. */
export function personName(person: { readonly fullName: string } | null | undefined): string {
  return person === null || person === undefined ? t('ops.common.unassigned') : person.fullName;
}
