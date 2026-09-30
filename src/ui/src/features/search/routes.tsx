/**
 * Global search and saved views (COM-08, FR-21, BR-43, DD-21). Personal (`/me/search`): every account holder, of
 * any organization kind, searches the records they may read in each of their active memberships. The top bar's
 * search box opens this page with `?q=`.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'search',
    area: 'common',
    routes: [
      {
        path: 'search',
        load: () => import('./pages/SearchPage'),
        title: 'search.title',
      },
    ],
    // No sidebar entry: the top bar search box leads here (DD-48).
  },
];
