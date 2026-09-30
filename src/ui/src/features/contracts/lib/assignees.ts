/**
 * Members eligible to own, manage, sign or own obligations of contracts (`buyer.contracts.assignees`), as select
 * options.
 */
import { contractsEndpoints } from '@contracts/contracts';
import type { ContractAssigneePurpose } from '@contracts/contracts';

import { useApiQuery } from '../../../api/hooks';
import type { SelectOption } from '../../../components/ui';

/** Select options of the members eligible for a purpose (owner, manager, obligation owner, signatory). */
export function useAssigneeOptions(purpose: ContractAssigneePurpose, enabled = true) {
  const query = useApiQuery(contractsEndpoints.assignees, enabled ? { query: { purpose } } : null);
  const options: SelectOption[] = (query.data?.items ?? []).map((item) => ({
    value: String(item.userId),
    label: item.capacity === null ? item.fullName : `${item.fullName} (${item.capacity})`,
  }));
  return { options, items: query.data?.items ?? [], query };
}
