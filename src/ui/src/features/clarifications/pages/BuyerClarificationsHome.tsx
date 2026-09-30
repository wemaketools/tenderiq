/** `/buyer/clarifications`: opens the first clarifications tab the membership may use. */
import { Navigate } from 'react-router';

import { useVisibleTabs } from '../hooks';

export default function BuyerClarificationsHome() {
  const first = useVisibleTabs()[0];
  return <Navigate to={first === undefined ? '/buyer' : first.to} replace />;
}
