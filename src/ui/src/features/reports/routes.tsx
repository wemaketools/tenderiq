/**
 * Management reporting (FR-21, PRD §13.2, §13.4, §15): REP-01 management reports (the family catalog and each
 * report), REP-02 report definition and export review, and ADM-13 reports and controlled exports (definitions and
 * the export history with manifests).
 */
import type { FeatureModule } from '../../app/featureRegistry';
import { EXPORT_READ, REPORT_ADMIN_READ, REPORT_READ } from './lib/shared';

export const features: FeatureModule[] = [
  {
    id: 'reports',
    area: 'buyer',
    routes: [
      {
        path: 'reports',
        load: () => import('./pages/ReportsPage'),
        permission: REPORT_READ,
        title: 'reports.catalog.title',
      },
      {
        path: 'reports/definitions/new',
        load: () => import('./pages/DefinitionPage'),
        permission: 'report.manage',
        title: 'reports.definition.newTitle',
      },
      {
        path: 'reports/definitions/:definitionId',
        load: () => import('./pages/DefinitionPage'),
        permission: REPORT_READ,
        title: 'reports.definition.title',
      },
      {
        path: 'reports/:family',
        load: () => import('./pages/ReportPage'),
        permission: REPORT_READ,
        title: 'reports.report.title',
      },
      {
        path: 'admin/reports',
        load: () => import('./pages/ReportDefinitionsPage'),
        permission: REPORT_ADMIN_READ,
        title: 'reports.admin.title',
      },
      {
        path: 'admin/reports/exports',
        load: () => import('./pages/ExportsPage'),
        permission: EXPORT_READ,
        title: 'reports.exports.title',
      },
      {
        path: 'admin/reports/exports/:exportId',
        load: () => import('./pages/ExportPage'),
        permission: EXPORT_READ,
        title: 'reports.exportDetail.title',
      },
    ],
    nav: [
      {
        id: 'buyer.reports',
        label: 'reports.nav.reports',
        path: 'reports',
        section: 'insights',
        order: 10,
        icon: 'barChart',
        permission: REPORT_READ,
        sectionAction: {
          label: 'reports.catalog.newDefinition',
          path: 'reports/definitions/new',
          icon: 'plus',
          permission: 'report.manage',
        },
      },
      {
        id: 'buyer.admin.reports',
        label: 'reports.nav.admin',
        path: 'admin/reports',
        section: 'insights',
        order: 20,
        icon: 'download',
        permission: ['report.manage', 'export.create', 'audit.view'],
        sectionAction: {
          label: 'reports.catalog.newDefinition',
          path: 'reports/definitions/new',
          icon: 'plus',
          permission: 'report.manage',
        },
      },
    ],
  },
];
