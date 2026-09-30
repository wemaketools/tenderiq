/**
 * `/supplier/opportunities/:tenderId/response` (the link that response notifications carry) continues to the
 * supplier's responses for that tender (SUP-12, owned by the bids domain).
 */
import { Navigate } from 'react-router';

import { useIdParam } from '../../publication/lib/hooks';
import { opportunityPaths } from '../../publication/lib/paths';

export default function ResponseRedirectPage() {
  const tenderId = useIdParam('tenderId');
  return (
    <Navigate
      to={
        tenderId === null
          ? opportunityPaths.discovery
          : opportunityPaths.responsesForTender(tenderId)
      }
      replace
    />
  );
}
