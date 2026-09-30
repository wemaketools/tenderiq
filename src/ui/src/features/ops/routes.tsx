/**
 * Platform operations (domain 16, FR-22, PRD §21, BR-46, BR-47): the operator area OPS-01..07. Customer register,
 * onboarding and offboarding (AC-36), plans and subscriptions, support cases with customer-authorized temporary
 * access, service incidents, platform oversight, announcements and help content. Operator views carry service
 * metadata only; they never show tender content.
 */
import { Navigate } from 'react-router';

import type { FeatureModule } from '../../app/featureRegistry';
import {
  CONTENT_READ,
  CUSTOMERS_READ,
  INCIDENTS_READ,
  OVERSIGHT,
  SUBSCRIPTIONS_READ,
  SUPPORT_READ,
} from './lib/permissions';

const announcementEditor = () => import('./pages/AnnouncementEditorPage');
const articleEditor = () => import('./pages/HelpArticleEditorPage');

export const features: FeatureModule[] = [
  {
    id: 'ops',
    area: 'ops',
    routes: [
      {
        path: 'customers',
        load: () => import('./pages/CustomersPage'),
        permission: CUSTOMERS_READ,
        title: 'ops.customers.title',
      },
      {
        path: 'customers/:customerTenantId',
        load: () => import('./pages/CustomerPage'),
        permission: CUSTOMERS_READ,
        title: 'ops.customer.title',
      },
      {
        path: 'customers/:customerTenantId/onboarding',
        load: () => import('./pages/OnboardingPage'),
        permission: CUSTOMERS_READ,
        title: 'ops.onboarding.title',
      },
      {
        path: 'offboarding',
        load: () => import('./pages/OffboardingPlansPage'),
        permission: CUSTOMERS_READ,
        title: 'ops.offboarding.title',
      },
      {
        path: 'offboarding/:planId',
        load: () => import('./pages/OffboardingPlanPage'),
        permission: CUSTOMERS_READ,
        title: 'ops.plan.title',
      },
      {
        path: 'subscriptions',
        load: () => import('./pages/SubscriptionsPage'),
        permission: SUBSCRIPTIONS_READ,
        title: 'ops.plans.title',
      },
      {
        path: 'subscriptions/:subscriptionId',
        load: () => import('./pages/SubscriptionPage'),
        permission: SUBSCRIPTIONS_READ,
        title: 'ops.subscription.title',
      },
      {
        path: 'support',
        load: () => import('./pages/SupportCasesPage'),
        permission: SUPPORT_READ,
        title: 'ops.support.title',
      },
      {
        path: 'support/grants',
        load: () => import('./pages/SupportGrantsPage'),
        permission: SUPPORT_READ,
        title: 'ops.grants.title',
      },
      {
        path: 'support/cases/:caseId',
        load: () => import('./pages/SupportCasePage'),
        permission: SUPPORT_READ,
        title: 'ops.case.title',
      },
      {
        path: 'incidents',
        load: () => import('./pages/IncidentsPage'),
        permission: INCIDENTS_READ,
        title: 'ops.incidents.title',
      },
      {
        path: 'incidents/:incidentId',
        load: () => import('./pages/IncidentPage'),
        permission: INCIDENTS_READ,
        title: 'ops.incident.title',
      },
      {
        path: 'oversight',
        load: () => import('./pages/OversightPage'),
        permission: OVERSIGHT,
        title: 'ops.oversight.title',
      },
      {
        path: 'content',
        element: <Navigate to="/ops/content/announcements" replace />,
        permission: CONTENT_READ,
      },
      {
        path: 'content/announcements',
        load: () => import('./pages/AnnouncementsPage'),
        permission: CONTENT_READ,
        title: 'ops.content.title',
      },
      {
        path: 'content/announcements/new',
        load: announcementEditor,
        permission: 'ops.content.manage',
        title: 'ops.announcement.newTitle',
      },
      {
        path: 'content/announcements/:announcementId',
        load: announcementEditor,
        permission: CONTENT_READ,
        title: 'ops.announcement.title',
      },
      {
        path: 'content/help',
        load: () => import('./pages/HelpArticlesPage'),
        permission: CONTENT_READ,
        title: 'ops.content.title',
      },
      {
        path: 'content/help/new',
        load: articleEditor,
        permission: 'ops.content.manage',
        title: 'ops.article.newTitle',
      },
      {
        path: 'content/help/:articleId',
        load: articleEditor,
        permission: CONTENT_READ,
        title: 'ops.article.title',
      },
    ],
    nav: [
      {
        id: 'ops.customers',
        label: 'ops.nav.customers',
        path: 'customers',
        section: 'platform',
        order: 10,
        icon: 'building',
        permission: CUSTOMERS_READ,
      },
      {
        id: 'ops.offboarding',
        label: 'ops.nav.offboarding',
        path: 'offboarding',
        section: 'platform',
        order: 20,
        icon: 'logOut',
        permission: CUSTOMERS_READ,
      },
      {
        id: 'ops.subscriptions',
        label: 'ops.nav.subscriptions',
        path: 'subscriptions',
        section: 'platform',
        order: 30,
        icon: 'receipt',
        permission: SUBSCRIPTIONS_READ,
      },
      {
        id: 'ops.support',
        label: 'ops.nav.support',
        path: 'support',
        section: 'platform',
        order: 40,
        icon: 'lifeBuoy',
        permission: SUPPORT_READ,
      },
      {
        id: 'ops.incidents',
        label: 'ops.nav.incidents',
        path: 'incidents',
        section: 'platform',
        order: 50,
        icon: 'activity',
        permission: INCIDENTS_READ,
      },
      {
        id: 'ops.oversight',
        label: 'ops.nav.oversight',
        path: 'oversight',
        section: 'platform',
        order: 60,
        icon: 'shieldCheck',
        permission: OVERSIGHT,
      },
      {
        id: 'ops.content',
        label: 'ops.nav.content',
        path: 'content',
        section: 'platform',
        order: 70,
        icon: 'megaphone',
        permission: CONTENT_READ,
      },
    ],
  },
];
