/** Operator staff as select options (service owner, case assignee, plan owner). */
import { operationsEndpoints } from '@contracts/operations';

import { useApiQuery } from '../../../api/hooks';
import type { SelectOption } from '../../../components/ui';

export function useOperatorStaffOptions(): readonly SelectOption[] {
  const staff = useApiQuery(operationsEndpoints.listOperatorStaff, {});
  return (staff.data ?? []).map((person) => ({
    value: String(person.userId),
    label: person.capacity === null ? person.fullName : `${person.fullName} (${person.capacity})`,
  }));
}
