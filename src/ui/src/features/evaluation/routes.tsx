/**
 * Evaluation (domain 11, FR-14, PRD §9): evaluator assignments (EVA-01), individual assessment (EVA-02), commercial
 * comparison (EVA-04), moderation (EVA-05) and ranking with the evaluation report (EVA-06). Access is
 * assignment-based (BR-26): the routes and navigation are offered by permission and the API limits every record to
 * the caller's assignments.
 */
import type { FeatureModule } from '../../app/featureRegistry';
import {
  ASSESSMENT_VIEW_PERMISSIONS,
  ASSIGNMENT_VIEW_PERMISSIONS,
  COMMERCIAL_VIEW_PERMISSIONS,
  EVALUATION_OVERVIEW_PERMISSIONS,
  MODERATION_VIEW_PERMISSIONS,
  RESULTS_VIEW_PERMISSIONS,
} from './lib/permissions';

export const features: FeatureModule[] = [
  {
    id: 'evaluation',
    area: 'buyer',
    routes: [
      {
        path: 'evaluation',
        load: () => import('./pages/EvaluationsPage'),
        permission: EVALUATION_OVERVIEW_PERMISSIONS,
        title: 'evaluation.list.title',
      },
      {
        path: 'evaluation/assignments',
        load: () => import('./pages/AssignmentsPage'),
        permission: ASSIGNMENT_VIEW_PERMISSIONS,
        title: 'evaluation.assignments.title',
      },
      {
        path: 'evaluation/assignments/:assignmentId',
        load: () => import('./pages/AssignmentPage'),
        permission: ASSIGNMENT_VIEW_PERMISSIONS,
        title: 'evaluation.assignment.title',
      },
      {
        path: 'evaluation/assignments/:assignmentId/assessment',
        load: () => import('./pages/AssessmentPage'),
        permission: ASSESSMENT_VIEW_PERMISSIONS,
        title: 'evaluation.assessment.title',
      },
      {
        path: 'evaluation/tenders/:tenderId',
        load: () => import('./pages/EvaluationOverviewPage'),
        permission: EVALUATION_OVERVIEW_PERMISSIONS,
        title: 'evaluation.overview.title',
      },
      {
        path: 'evaluation/tenders/:tenderId/commercial',
        load: () => import('./pages/CommercialPage'),
        permission: COMMERCIAL_VIEW_PERMISSIONS,
        title: 'evaluation.commercial.title',
      },
      {
        path: 'evaluation/tenders/:tenderId/moderation',
        load: () => import('./pages/ModerationPage'),
        permission: MODERATION_VIEW_PERMISSIONS,
        title: 'evaluation.moderation.title',
      },
      {
        path: 'evaluation/tenders/:tenderId/results',
        load: () => import('./pages/ResultsPage'),
        permission: RESULTS_VIEW_PERMISSIONS,
        title: 'evaluation.results.title',
      },
    ],
    nav: [
      {
        id: 'buyer.evaluation.assignments',
        label: 'evaluation.nav.assignments',
        path: 'evaluation/assignments',
        section: 'evaluation',
        order: 40,
        icon: 'userCheck',
        permission: ASSIGNMENT_VIEW_PERMISSIONS,
      },
      {
        id: 'buyer.evaluation.evaluations',
        label: 'evaluation.nav.evaluations',
        path: 'evaluation',
        section: 'evaluation',
        order: 50,
        icon: 'scale',
        permission: EVALUATION_OVERVIEW_PERMISSIONS,
        end: true,
      },
    ],
  },
];
