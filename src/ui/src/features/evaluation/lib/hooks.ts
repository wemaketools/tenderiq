/**
 * Small hooks shared by the evaluation pages.
 */
import { useParams, useSearchParams } from 'react-router';

import { parseId } from './lists';

/** A positive integer route parameter, or null when it is missing or malformed. */
export function useIdParam(name: string): number | null {
  const params = useParams();
  return parseId(params[name]);
}

/** The `?lotId=` of a per-lot evaluation, or null for a tender evaluated as a whole. */
export function useLotId(): number | null {
  const [search] = useSearchParams();
  return parseId(search.get('lotId'));
}
