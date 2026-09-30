/**
 * Awards (domain 13, FR-17, BR-31..BR-35), buyer area: BUY-26 award register, award file and recommendation,
 * BUY-28 outcome notices, standstill and public award notice, BUY-29 debriefs and complaints, BUY-30 event closeout.
 * Supplier outcomes and public awards live in the `outcomes` feature.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { AWARD_READ, CASE_READ, CLOSEOUT_READ, NOTICE_READ } from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'awards',
    area: 'buyer',
    routes: [
      {
        path: 'awards',
        load: () => import('./pages/AwardRegisterPage'),
        permission: AWARD_READ,
        title: 'awards.register.title',
      },
      {
        path: 'awards/:tenderId',
        load: () => import('./pages/AwardOverviewPage'),
        permission: AWARD_READ,
        title: 'awards.file.title',
      },
      {
        path: 'awards/:tenderId/recommendations/:recommendationId',
        load: () => import('./pages/RecommendationPage'),
        permission: AWARD_READ,
        title: 'awards.recommendation.title',
      },
      {
        path: 'awards/:tenderId/notices',
        load: () => import('./pages/NoticesPage'),
        permission: NOTICE_READ,
        title: 'awards.notices.title',
      },
      {
        path: 'awards/:tenderId/notices/:noticeId',
        load: () => import('./pages/NoticePage'),
        permission: NOTICE_READ,
        title: 'awards.notice.title',
      },
      {
        path: 'awards/:tenderId/closeout',
        load: () => import('./pages/CloseoutPage'),
        permission: CLOSEOUT_READ,
        title: 'awards.closeout.title',
      },
      {
        path: 'closeout',
        load: () => import('./pages/CloseoutRegisterPage'),
        permission: CLOSEOUT_READ,
        title: 'awards.closeoutRegister.title',
      },
      {
        path: 'award-cases',
        load: () => import('./pages/DebriefsPage'),
        permission: CASE_READ,
        title: 'awards.cases.title',
      },
      {
        path: 'award-cases/debriefs/:debriefId',
        load: () => import('./pages/DebriefPage'),
        permission: CASE_READ,
        title: 'awards.debrief.title',
      },
      {
        path: 'award-cases/complaints',
        load: () => import('./pages/ComplaintsPage'),
        permission: CASE_READ,
        title: 'awards.cases.title',
      },
      {
        path: 'award-cases/complaints/:complaintId',
        load: () => import('./pages/ComplaintPage'),
        permission: CASE_READ,
        title: 'awards.complaint.title',
      },
    ],
    nav: [
      {
        id: 'buyer.awards',
        label: 'awards.nav.awards',
        path: 'awards',
        section: 'award',
        order: 10,
        icon: 'award',
        permission: AWARD_READ,
      },
      {
        id: 'buyer.award-cases',
        label: 'awards.nav.cases',
        path: 'award-cases',
        section: 'award',
        order: 20,
        icon: 'gavel',
        permission: CASE_READ,
      },
      {
        id: 'buyer.closeout',
        label: 'awards.nav.closeout',
        path: 'closeout',
        section: 'award',
        order: 30,
        icon: 'flag',
        permission: CLOSEOUT_READ,
      },
    ],
  },
];
