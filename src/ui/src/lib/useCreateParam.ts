/**
 * A create dialog opened from the address (DD-46). A section action in the top bar always navigates; when a
 * destination creates through a dialog, its section action links to the list page with `?new=1` and the page keeps
 * the dialog open while the parameter is present. Closing the dialog removes the parameter (replacing the history
 * entry, so Back does not reopen it) and keeps every other parameter, such as the list filters.
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

export const CREATE_PARAM = 'new';

export function useCreateParam(): readonly [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const open = params.get(CREATE_PARAM) === '1';
  const setOpen = useCallback(
    (next: boolean): void => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (next) {
            updated.set(CREATE_PARAM, '1');
          } else {
            updated.delete(CREATE_PARAM);
          }
          return updated;
        },
        { replace: !next },
      );
    },
    [setParams],
  );
  return [open, setOpen] as const;
}
