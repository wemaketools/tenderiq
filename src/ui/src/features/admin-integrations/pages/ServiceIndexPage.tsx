/** The entry of the service area: opens the first screen the membership may use. */
import { Navigate } from 'react-router';

import { RestrictedState } from '../../../components/ui';
import { useServiceTabs } from '../lib/tabs';

export default function ServiceIndexPage() {
  const tabs = useServiceTabs();
  const first = tabs[0];
  if (first === undefined) return <RestrictedState />;
  return <Navigate to={first.to} replace />;
}
