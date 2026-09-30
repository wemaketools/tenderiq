/**
 * Qualification (domain 04; FR-06, BR-03, BR-23, BR-24, BR-25, BR-48): ADM-09 programs, BUY-33 review queue,
 * BUY-34 assessment, BUY-35 decisions and monitoring, SUP-20 applications and SUP-24 decisions and renewals.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { PROGRAM_READ, SUPPLIER_DECISIONS_READ, WORK_READ } from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'qualification',
    area: 'buyer',
    routes: [
      {
        path: 'qualification',
        load: () => import('./pages/buyer/QueuePage'),
        permission: WORK_READ,
        title: 'qualification.queue.title',
      },
      {
        path: 'qualification/applications/:applicationId',
        load: () => import('./pages/buyer/AssessmentPage'),
        permission: WORK_READ,
        title: 'qualification.assessment.loadingTitle',
      },
      {
        path: 'qualification/applications/:applicationId/decision',
        load: () => import('./pages/buyer/DecidePage'),
        permission: 'qualification.decide',
        title: 'qualification.decide.pageTitle',
      },
      {
        path: 'qualification/monitoring',
        load: () => import('./pages/buyer/MonitoringPage'),
        permission: WORK_READ,
        title: 'qualification.monitoring.title',
      },
      {
        path: 'qualification/decisions/:decisionId',
        load: () => import('./pages/buyer/DecisionPage'),
        permission: WORK_READ,
        title: 'qualification.decision.loadingTitle',
      },
      {
        path: 'qualification/triggers/:triggerId',
        load: () => import('./pages/buyer/TriggerPage'),
        permission: WORK_READ,
        title: 'qualification.trigger.loadingTitle',
      },
      {
        path: 'admin/qualification',
        load: () => import('./pages/admin/ProgramsPage'),
        permission: PROGRAM_READ,
        title: 'qualification.programs.title',
      },
      {
        path: 'admin/qualification/new',
        load: () => import('./pages/admin/ProgramNewPage'),
        permission: 'qualification.program.manage',
        title: 'qualification.programNew.title',
      },
      {
        path: 'admin/qualification/:programId',
        load: () => import('./pages/admin/ProgramPage'),
        permission: PROGRAM_READ,
        title: 'qualification.program.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'buyer.qualification.queue',
        label: 'qualification.nav.queue',
        path: 'qualification',
        section: 'suppliers',
        order: 20,
        icon: 'listChecks',
        permission: WORK_READ,
        end: true,
      },
      {
        id: 'buyer.qualification.monitoring',
        label: 'qualification.nav.monitoring',
        path: 'qualification/monitoring',
        section: 'suppliers',
        order: 21,
        icon: 'shieldCheck',
        permission: WORK_READ,
      },
      {
        id: 'buyer.qualification.programs',
        label: 'qualification.nav.programs',
        path: 'admin/qualification',
        section: 'admin',
        order: 40,
        icon: 'layers',
        permission: PROGRAM_READ,
      },
    ],
  },
  {
    id: 'qualification-supplier',
    area: 'supplier',
    routes: [
      {
        path: 'qualification',
        load: () => import('./pages/supplier/SupplierQualificationPage'),
        permission: SUPPLIER_DECISIONS_READ,
        title: 'qualification.supplier.title',
      },
      {
        path: 'qualification/programs/:programId',
        load: () => import('./pages/supplier/SupplierProgramPage'),
        permission: 'supplier.qualification.apply',
        title: 'qualification.supplierProgram.loadingTitle',
      },
      {
        path: 'qualification/applications/:applicationId',
        load: () => import('./pages/supplier/SupplierApplicationPage'),
        permission: 'supplier.qualification.apply',
        title: 'qualification.application.loadingTitle',
      },
      {
        path: 'qualification/decisions',
        load: () => import('./pages/supplier/SupplierDecisionsPage'),
        permission: SUPPLIER_DECISIONS_READ,
        title: 'qualification.supplierDecisions.title',
      },
      {
        path: 'qualification/decisions/:decisionId',
        load: () => import('./pages/supplier/SupplierDecisionPage'),
        permission: SUPPLIER_DECISIONS_READ,
        title: 'qualification.decision.loadingTitle',
      },
    ],
    nav: [
      {
        id: 'supplier.qualification',
        label: 'qualification.nav.supplierApplications',
        path: 'qualification',
        section: 'suppliers',
        order: 10,
        icon: 'clipboardCheck',
        permission: SUPPLIER_DECISIONS_READ,
        end: true,
      },
      {
        id: 'supplier.qualification.decisions',
        label: 'qualification.nav.supplierDecisions',
        path: 'qualification/decisions',
        section: 'suppliers',
        order: 11,
        icon: 'shieldCheck',
        permission: SUPPLIER_DECISIONS_READ,
      },
    ],
  },
];
