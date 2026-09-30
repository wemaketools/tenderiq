/**
 * Help, accessibility and service cases (COM-09, PRD §19, §21.2): the signed-in help centre at /me/help (guidance,
 * terminology, service notices, contacts, personal service cases and accommodation requests) and the public service
 * status page. Support is never a bid-submission channel.
 */
import type { FeatureModule } from '../../app/featureRegistry';

export const features: FeatureModule[] = [
  {
    id: 'help',
    area: 'common',
    routes: [
      { path: 'help', load: () => import('./pages/HelpCentrePage'), title: 'help.title' },
      {
        path: 'help/articles/:articleSlug',
        load: () => import('./pages/HelpArticlePage'),
        title: 'help.article.title',
      },
      {
        path: 'help/cases/:caseId',
        load: () => import('./pages/MyCasePage'),
        title: 'help.case.title',
      },
    ],
    // No sidebar entry: the top bar help icon leads here (DD-48).
  },
  {
    id: 'help-public',
    area: 'public',
    routes: [
      {
        path: 'service-status',
        load: () => import('./pages/PublicServicePage'),
        title: 'help.public.title',
      },
    ],
  },
];
