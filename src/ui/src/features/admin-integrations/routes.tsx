/**
 * Buyer service screens (domain 16): ADM-15 integration register and exceptions (AC-33), ADM-16 imports and
 * duplicate review, ADM-17 subscription and offboarding (AC-36), and the customer-side authorization of support
 * access (OPS-04). One sidebar entry opens the first screen the membership may use; the settings sub-navigation
 * lists the others.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  EXCEPTIONS_ACCESS,
  IMPORTS_MANAGE,
  INTEGRATIONS_MANAGE,
  SERVICE_AREA,
  SUBSCRIPTION_VIEW,
  SUPPORT_ACCESS,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'admin-integrations',
    area: 'buyer',
    routes: [
      {
        path: 'admin/service',
        load: () => import('./pages/ServiceIndexPage'),
        permission: SERVICE_AREA,
        title: 'admin-integrations.nav.title',
      },
      {
        path: 'admin/service/integrations',
        load: () => import('./pages/IntegrationsPage'),
        permission: INTEGRATIONS_MANAGE,
        title: 'admin-integrations.list.title',
      },
      {
        path: 'admin/service/integrations/:connectionId',
        load: () => import('./pages/IntegrationPage'),
        permission: INTEGRATIONS_MANAGE,
        title: 'admin-integrations.detail.title',
      },
      {
        path: 'admin/service/exceptions',
        load: () => import('./pages/ExceptionsPage'),
        permission: EXCEPTIONS_ACCESS,
        title: 'admin-integrations.exceptions.title',
      },
      {
        path: 'admin/service/exceptions/:exceptionId',
        load: () => import('./pages/ExceptionPage'),
        permission: EXCEPTIONS_ACCESS,
        title: 'admin-integrations.exception.title',
      },
      {
        path: 'admin/service/imports',
        load: () => import('./pages/ImportsPage'),
        permission: IMPORTS_MANAGE,
        title: 'admin-integrations.imports.title',
      },
      {
        path: 'admin/service/imports/:batchId',
        load: () => import('./pages/ImportBatchPage'),
        permission: IMPORTS_MANAGE,
        title: 'admin-integrations.batch.title',
      },
      {
        path: 'admin/service/subscription',
        load: () => import('./pages/SubscriptionPage'),
        permission: SUBSCRIPTION_VIEW,
        title: 'admin-integrations.subscription.title',
      },
      {
        path: 'admin/service/support-access',
        load: () => import('./pages/SupportAccessPage'),
        permission: SUPPORT_ACCESS,
        title: 'admin-integrations.support.title',
      },
      {
        path: 'admin/service/support-access/:grantId',
        load: () => import('./pages/SupportGrantPage'),
        permission: SUPPORT_ACCESS,
        title: 'admin-integrations.grant.title',
      },
    ],
    nav: [
      {
        id: 'buyer.admin-integrations',
        label: 'admin-integrations.nav.title',
        path: 'admin/service',
        section: 'admin',
        order: 70,
        icon: 'plug',
        permission: SERVICE_AREA,
      },
    ],
  },
];
