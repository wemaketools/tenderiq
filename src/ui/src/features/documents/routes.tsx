/**
 * Workspace — COM-07 document and evidence viewer (PRD §14.1). Personal (`/me/documents`): documents of the
 * records the caller may read in every active organization (DD-21); access follows the related record.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'documents',
    area: 'common',
    routes: [
      {
        path: 'documents',
        load: () => import('./pages/MyDocumentsPage'),
        title: 'documents.list.title',
      },
      {
        path: 'documents/:documentId',
        load: () => import('./pages/DocumentViewerPage'),
        title: 'documents.viewer.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'me.documents',
        label: 'documents.nav.documents',
        path: 'documents',
        section: 'work',
        order: 40,
        icon: 'files',
      },
    ],
  },
];
