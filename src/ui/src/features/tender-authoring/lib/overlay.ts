/**
 * Command results over a fetched list.
 *
 * Prototype commands are static (foundation-contract §2.3): the next GET returns the fixture again, so a page keeps
 * the records its commands returned and lays them over the fetched rows: an edited record replaces its row, a new
 * record is appended and a removed one disappears. Stage B returns the same shapes, so nothing here is prototype
 * specific; the overlay simply stays empty after a refetch shows the change.
 */
import { useCallback, useMemo, useState } from 'react';

import type {
  ReadinessCounts,
  ReadinessItem,
  ReleaseApprovalRequested,
  ReleaseApprovalState,
  PublicationGate,
} from '@contracts/tenders';

export interface Overlay<T extends { readonly id: number }> {
  /** The fetched rows with the command results applied. */
  readonly apply: (rows: readonly T[]) => T[];
  /** Records a created or edited record. */
  readonly put: (row: T) => void;
  /** Records a removal. */
  readonly remove: (id: number) => void;
}

interface OverlayState<T> {
  readonly records: ReadonlyMap<number, T>;
  readonly removed: ReadonlySet<number>;
}

export function useOverlay<T extends { readonly id: number }>(): Overlay<T> {
  const [state, setState] = useState<OverlayState<T>>({ records: new Map(), removed: new Set() });

  const put = useCallback((row: T) => {
    setState((current) => {
      const records = new Map(current.records);
      records.set(row.id, row);
      const removed = new Set(current.removed);
      removed.delete(row.id);
      return { records, removed };
    });
  }, []);

  const remove = useCallback((id: number) => {
    setState((current) => {
      const records = new Map(current.records);
      records.delete(id);
      const removed = new Set(current.removed);
      removed.add(id);
      return { records, removed };
    });
  }, []);

  const apply = useCallback(
    (rows: readonly T[]): T[] => {
      const ids = new Set(rows.map((row) => row.id));
      const merged = rows.map((row) => state.records.get(row.id) ?? row);
      for (const [id, row] of state.records) {
        if (!ids.has(id)) merged.push(row);
      }
      return merged.filter((row) => !state.removed.has(row.id));
    },
    [state],
  );

  return useMemo(() => ({ apply, put, remove }), [apply, put, remove]);
}

/** The parts of a fetched release view that a release approval request changes. */
export interface ReleaseApprovalView {
  readonly readiness: readonly ReadinessItem[];
  readonly summary: ReadinessCounts;
  readonly gate: PublicationGate;
  readonly releaseApproval: ReleaseApprovalState | null;
  readonly approvalHistory: readonly ReleaseApprovalState[];
}

/**
 * Lays a recorded release approval request over a fetched release view: the new pending approval, its place at the
 * head of the history, and the readiness, counts and publication gate the request returned (so the page no longer
 * says that approval can be requested).
 */
export function withReleaseApprovalRequested<T extends ReleaseApprovalView>(
  view: T,
  result: ReleaseApprovalRequested | null,
): T {
  if (result === null) return view;
  return {
    ...view,
    readiness: result.readiness,
    summary: result.summary,
    gate: result.gate,
    releaseApproval: result.approval,
    approvalHistory: [
      result.approval,
      ...view.approvalHistory.filter((row) => row.approvalId !== result.approval.approvalId),
    ],
  };
}
