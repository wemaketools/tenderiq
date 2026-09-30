/**
 * Publication feature (FR-08): publication and distribution (BUY-14) and participants and document access (BUY-15)
 * for buyers. The public portal lives in `public-portal` and the supplier opportunity screens in `opportunities`.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { PARTICIPANT_READ, PUBLICATION_READ } from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'publication',
    area: 'buyer',
    routes: [
      {
        path: 'publications',
        load: () => import('./pages/PublicationRegisterPage'),
        permission: PUBLICATION_READ,
        title: 'publication.register.title',
      },
      {
        path: 'tenders/:tenderId/publication',
        load: () => import('./pages/TenderPublicationPage'),
        permission: PUBLICATION_READ,
        title: 'publication.nav.publication',
      },
      {
        path: 'tenders/:tenderId/participants',
        load: () => import('./pages/ParticipantsPage'),
        permission: PARTICIPANT_READ,
        title: 'publication.tabs.participants',
      },
      {
        path: 'tenders/:tenderId/participants/:participantId',
        load: () => import('./pages/ParticipantPage'),
        permission: PARTICIPANT_READ,
        title: 'publication.tabs.participants',
      },
    ],
    nav: [
      {
        id: 'buyer.publications',
        label: 'publication.nav.publication',
        path: 'publications',
        section: 'sourcing',
        order: 30,
        icon: 'megaphone',
        permission: PUBLICATION_READ,
      },
    ],
  },
];
