/**
 * Audit, retention and legal holds (ADM-14; FR-22, PRD §18, BR-38–BR-40, AC-35): the audit viewer, retention
 * schedules, legal and investigation holds, disposal eligibility and evidence packs of the active buyer.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  AUDIT_READ,
  EVIDENCE_PACKS_READ,
  RECORDS_READ,
  RECORDS_WORKSPACE,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'records',
    area: 'buyer',
    routes: [
      {
        path: 'admin/records',
        load: () => import('./pages/RecordsOverviewPage'),
        permission: RECORDS_WORKSPACE,
        title: 'records.title',
      },
      {
        path: 'admin/records/audit',
        load: () => import('./pages/AuditEventsPage'),
        permission: AUDIT_READ,
        title: 'records.audit.title',
      },
      {
        path: 'admin/records/retention',
        load: () => import('./pages/RetentionPage'),
        permission: RECORDS_READ,
        title: 'records.retention.title',
      },
      {
        path: 'admin/records/holds',
        load: () => import('./pages/HoldsPage'),
        permission: RECORDS_READ,
        title: 'records.holds.title',
      },
      {
        path: 'admin/records/holds/:holdId',
        load: () => import('./pages/HoldPage'),
        permission: RECORDS_READ,
        title: 'records.holds.detailTitle',
      },
      {
        path: 'admin/records/disposals',
        load: () => import('./pages/DisposalsPage'),
        permission: RECORDS_READ,
        title: 'records.disposals.title',
      },
      {
        path: 'admin/records/disposals/:disposalRequestId',
        load: () => import('./pages/DisposalPage'),
        permission: RECORDS_READ,
        title: 'records.disposals.detailTitle',
      },
      {
        path: 'admin/records/evidence-packs',
        load: () => import('./pages/EvidencePacksPage'),
        permission: EVIDENCE_PACKS_READ,
        title: 'records.packs.title',
      },
    ],
    nav: [
      {
        id: 'buyer.admin.records',
        label: 'records.nav.records',
        path: 'admin/records',
        section: 'insights',
        order: 30,
        icon: 'archive',
        permission: RECORDS_WORKSPACE,
      },
    ],
  },
];
