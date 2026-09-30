/**
 * Report definition helpers (REP-02, ADM-13): the empty saved-filter configuration, the icons of the report
 * families, the editable form state of a definition and its conversion to the contract body.
 */
import type { ReportDefinitionsFamily, TendersEventType, TendersStatus } from '@contracts/enums';
import type {
  ReportAudiencePermission,
  ReportDefinition,
  ReportDefinitionBody,
  ReportFilters,
} from '@contracts/reporting';

import type { IconName } from '../../../components/ui';

export const EMPTY_FILTERS: ReportFilters = {
  from: null,
  to: null,
  legalEntityIds: [],
  departmentIds: [],
  categoryIds: [],
  ownerUserIds: [],
  stages: [],
  eventTypes: [],
  level: 'both',
};

export const FAMILY_ICON: Readonly<Record<ReportDefinitionsFamily, IconName>> = {
  pipeline: 'barChart',
  cycle_time: 'timer',
  participation: 'users',
  qualification_risk: 'shieldCheck',
  evaluation_integrity: 'scale',
  awards: 'award',
  commercial_outcomes: 'coins',
  contract_performance: 'fileSignature',
  complaints: 'gavel',
  audit_records: 'archive',
};

/** The editable state of the REP-02 form (strings as entered; ids as strings for the selects). */
export interface DefinitionForm {
  readonly name: string;
  readonly family: ReportDefinitionsFamily;
  readonly fields: readonly string[];
  readonly from: string;
  readonly to: string;
  readonly legalEntityIds: readonly string[];
  readonly departmentIds: readonly string[];
  readonly categoryIds: readonly string[];
  readonly ownerUserIds: readonly string[];
  readonly stages: readonly TendersStatus[];
  readonly eventTypes: readonly TendersEventType[];
  readonly level: ReportFilters['level'];
  readonly currencyBasis: string;
  readonly conversionDate: string;
  readonly audiencePermission: ReportAudiencePermission;
  readonly scheduled: boolean;
  readonly scheduleCron: string;
  readonly recipientUserIds: readonly number[];
}

export function emptyForm(
  family: ReportDefinitionsFamily,
  fields: readonly string[],
  currency: string,
): DefinitionForm {
  return {
    name: '',
    family,
    fields,
    from: '',
    to: '',
    legalEntityIds: [],
    departmentIds: [],
    categoryIds: [],
    ownerUserIds: [],
    stages: [],
    eventTypes: [],
    level: 'both',
    currencyBasis: currency,
    conversionDate: '',
    audiencePermission: 'report.view',
    scheduled: false,
    scheduleCron: '0 6 * * 1',
    recipientUserIds: [],
  };
}

export function formOf(definition: ReportDefinition): DefinitionForm {
  const ids = (values: readonly number[]): string[] => values.map(String);
  return {
    name: definition.name,
    family: definition.family,
    fields: definition.fields,
    from: definition.filters.from ?? '',
    to: definition.filters.to ?? '',
    legalEntityIds: ids(definition.filters.legalEntityIds),
    departmentIds: ids(definition.filters.departmentIds),
    categoryIds: ids(definition.filters.categoryIds),
    ownerUserIds: ids(definition.filters.ownerUserIds),
    stages: definition.filters.stages,
    eventTypes: definition.filters.eventTypes,
    level: definition.filters.level,
    currencyBasis: definition.currencyBasis,
    conversionDate: definition.conversionDate ?? '',
    audiencePermission: definition.audiencePermission,
    scheduled: definition.schedule !== null,
    scheduleCron: definition.schedule?.cron ?? '0 6 * * 1',
    recipientUserIds: definition.recipients.map((recipient) => recipient.user.userId),
  };
}

export function filtersOf(form: DefinitionForm): ReportFilters {
  const ids = (values: readonly string[]): number[] =>
    values.map(Number).filter((value) => Number.isInteger(value) && value > 0);
  return {
    from: form.from === '' ? null : form.from,
    to: form.to === '' ? null : form.to,
    legalEntityIds: ids(form.legalEntityIds),
    departmentIds: ids(form.departmentIds),
    categoryIds: ids(form.categoryIds),
    ownerUserIds: ids(form.ownerUserIds),
    stages: [...form.stages],
    eventTypes: [...form.eventTypes],
    level: form.level,
  };
}

export function bodyOf(form: DefinitionForm): ReportDefinitionBody {
  return {
    name: form.name.trim(),
    family: form.family,
    fields: [...form.fields],
    filters: filtersOf(form),
    currencyBasis: form.currencyBasis.trim().toUpperCase(),
    conversionDate: form.conversionDate === '' ? null : form.conversionDate,
    audiencePermission: form.audiencePermission,
    scheduleCron: form.scheduled ? form.scheduleCron.trim() : null,
    recipientUserIds: [...form.recipientUserIds],
  };
}

/** Client-side checks mirroring the contract, keyed by the contract field path. */
export function validateForm(form: DefinitionForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const name = form.name.trim();
  if (name.length < 3) errors.name = 'reports.definition.errors.nameShort';
  if (name.length > 120) errors.name = 'reports.definition.errors.nameLong';
  if (form.fields.length === 0) errors.fields = 'reports.definition.errors.fields';
  if (!/^[A-Z]{3}$/.test(form.currencyBasis.trim().toUpperCase())) {
    errors.currencyBasis = 'reports.definition.errors.currency';
  }
  if (form.from !== '' && form.to !== '' && form.from > form.to) {
    errors['filters.to'] = 'reports.definition.errors.range';
  }
  if (form.scheduled) {
    const fields = form.scheduleCron.trim().split(/\s+/);
    if (fields.length !== 5) errors.scheduleCron = 'reports.definition.errors.schedule';
    if (form.recipientUserIds.length === 0) {
      errors.recipientUserIds = 'reports.definition.errors.recipients';
    }
  }
  return errors;
}
