/** Active members of the buyer as select options (integration business owner, exception owner). */
import { operationsEndpoints } from '@contracts/operations';

import { useApiQuery } from '../../../api/hooks';
import type { SelectOption } from '../../../components/ui';

export function usePeopleOptions(): readonly SelectOption[] {
  const people = useApiQuery(operationsEndpoints.listOperationsPeople, {});
  return (people.data ?? []).map((person) => ({
    value: String(person.userId),
    label: person.capacity === null ? person.fullName : `${person.fullName} (${person.capacity})`,
  }));
}
