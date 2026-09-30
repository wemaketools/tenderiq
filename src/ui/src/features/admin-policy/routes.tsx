/**
 * Policy administration (domain 02, FR-22, PRD §17): ADM-06 procurement policy profiles, ADM-07 forms and business
 * fields, ADM-08 the template and content library, ADM-11 the public portal and publication policy. One sidebar
 * entry opens the first screen the membership may use; the sub-navigation lists the others.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  FIELDS_READ,
  POLICY_AREA_READ,
  PORTAL_READ,
  PROFILES_READ,
  TEMPLATES_READ,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'admin-policy',
    area: 'buyer',
    routes: [
      {
        path: 'admin/policy',
        load: () => import('./pages/PolicyIndexPage'),
        permission: POLICY_AREA_READ,
        title: 'admin-policy.nav.title',
      },
      {
        path: 'admin/policy/profiles',
        load: () => import('./pages/PolicyProfilesPage'),
        permission: PROFILES_READ,
        title: 'admin-policy.profiles.title',
      },
      {
        path: 'admin/policy/profiles/new',
        load: () => import('./pages/PolicyProfileNewPage'),
        permission: 'org.policy.manage',
        title: 'admin-policy.profileNew.title',
      },
      {
        path: 'admin/policy/profiles/:profileId',
        load: () => import('./pages/PolicyProfilePage'),
        permission: PROFILES_READ,
        title: 'admin-policy.profiles.title',
      },
      {
        path: 'admin/policy/profiles/:profileId/versions/:versionId',
        load: () => import('./pages/PolicyVersionPage'),
        permission: PROFILES_READ,
        title: 'admin-policy.profiles.title',
      },
      {
        path: 'admin/policy/fields',
        load: () => import('./pages/CustomFieldsPage'),
        permission: FIELDS_READ,
        title: 'admin-policy.fields.title',
      },
      {
        path: 'admin/policy/fields/new',
        load: () => import('./pages/CustomFieldNewPage'),
        permission: 'org.fields.manage',
        title: 'admin-policy.fieldNew.title',
      },
      {
        path: 'admin/policy/fields/:fieldId',
        load: () => import('./pages/CustomFieldPage'),
        permission: FIELDS_READ,
        title: 'admin-policy.fields.title',
      },
      {
        path: 'admin/policy/templates',
        load: () => import('./pages/TemplatesPage'),
        permission: TEMPLATES_READ,
        title: 'admin-policy.templates.title',
      },
      {
        path: 'admin/policy/templates/new',
        load: () => import('./pages/TemplateNewPage'),
        permission: 'org.templates.manage',
        title: 'admin-policy.templateNew.title',
      },
      {
        path: 'admin/policy/templates/:templateId',
        load: () => import('./pages/TemplatePage'),
        permission: TEMPLATES_READ,
        title: 'admin-policy.templates.title',
      },
      {
        path: 'admin/policy/portal',
        load: () => import('./pages/PortalPolicyPage'),
        permission: PORTAL_READ,
        title: 'admin-policy.portal.title',
      },
    ],
    nav: [
      {
        id: 'buyer.admin-policy',
        label: 'admin-policy.nav.title',
        path: 'admin/policy',
        section: 'admin',
        order: 30,
        icon: 'sliders',
        permission: POLICY_AREA_READ,
      },
    ],
  },
];
