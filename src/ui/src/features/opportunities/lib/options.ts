/**
 * Select options of the SUP-06 filters and dialogs, built from the discovery filter options and the supplier
 * profile (categories, buyers and regions this supplier may see).
 */
import type { OpportunityFilters } from '@contracts/publication';

import type { SelectOption } from '../../../components/ui';

/** Category options: the visible opportunities' categories plus the supplier profile's categories. */
export function categoryOptions(filters: OpportunityFilters | undefined): SelectOption[] {
  const seen = new Map<string, string>();
  for (const option of filters?.categories ?? []) seen.set(option.value, option.label);
  for (const category of filters?.profileCategories ?? []) {
    if (!seen.has(category.code)) seen.set(category.code, category.name);
  }
  return [...seen.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label: `${label} (${value})` }));
}

export function buyerOptions(filters: OpportunityFilters | undefined): SelectOption[] {
  return (filters?.buyers ?? []).map((option) => ({ value: option.value, label: option.label }));
}

export function regionOptions(filters: OpportunityFilters | undefined): SelectOption[] {
  const seen = new Set<string>([
    ...(filters?.regions ?? []).map((option) => option.value),
    ...(filters?.profileRegions ?? []),
  ]);
  return [...seen].sort().map((value) => ({ value, label: value }));
}
