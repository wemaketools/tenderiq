import { describe, expect, it } from 'vitest';

import {
  EVALUATION_NEXT_ACTIONS,
  GATE_FAILURE_CODES,
  PEER_SCORE_VISIBILITIES,
  RESULT_DETAIL_LEVELS,
  evaluationEndpoints,
} from '@contracts/evaluation';
import { permissionsForTemplates } from '@contracts/permissions';
import type { RoleTemplateCode } from '@contracts/permissions';

import { hasPermission, navGroupsFor } from '../../app/featureRegistry';
import { hasTranslation } from '../../lib/i18n';
import { features } from './routes';

function navFor(templates: RoleTemplateCode[]): string[] {
  return navGroupsFor(features, {
    tenantKind: 'buyer',
    permissions: permissionsForTemplates(templates),
  })
    .flatMap((group) => group.items)
    .map((item) => item.to);
}

function routeAllowed(path: string, templates: RoleTemplateCode[]): boolean {
  const route = features[0]?.routes.find((item) => item.path === path);
  return route !== undefined && hasPermission(route.permission, permissionsForTemplates(templates));
}

describe('evaluation navigation and route permissions', () => {
  it('shows assignments and evaluations to the chair and to evaluators', () => {
    expect(navFor(['evaluation_chair'])).toEqual([
      '/buyer/evaluation/assignments',
      '/buyer/evaluation',
    ]);
    expect(navFor(['evaluator'])).toEqual(['/buyer/evaluation/assignments', '/buyer/evaluation']);
    expect(navFor(['commercial_reviewer'])).toEqual([
      '/buyer/evaluation/assignments',
      '/buyer/evaluation',
    ]);
  });

  it('shows only the evaluations overview to the award team', () => {
    expect(navFor(['procurement_officer'])).toEqual(['/buyer/evaluation']);
    expect(navFor(['award_approver'])).toEqual(['/buyer/evaluation']);
  });

  it('hides evaluation entirely from administrators and auditors (BR-26)', () => {
    expect(navFor(['org_admin'])).toEqual([]);
    expect(navFor(['auditor'])).toEqual([]);
  });

  it('guards each screen with the permission of its role', () => {
    expect(routeAllowed('evaluation/assignments/:assignmentId/assessment', ['evaluator'])).toBe(
      true,
    );
    expect(
      routeAllowed('evaluation/assignments/:assignmentId/assessment', ['commercial_reviewer']),
    ).toBe(false);
    expect(routeAllowed('evaluation/tenders/:tenderId/commercial', ['commercial_reviewer'])).toBe(
      true,
    );
    expect(routeAllowed('evaluation/tenders/:tenderId/commercial', ['evaluator'])).toBe(false);
    expect(routeAllowed('evaluation/tenders/:tenderId/moderation', ['evaluation_chair'])).toBe(
      true,
    );
    expect(routeAllowed('evaluation/tenders/:tenderId/moderation', ['procurement_officer'])).toBe(
      false,
    );
    expect(routeAllowed('evaluation/tenders/:tenderId/results', ['procurement_officer'])).toBe(
      true,
    );
    expect(routeAllowed('evaluation/tenders/:tenderId/results', ['org_admin'])).toBe(false);
  });

  it('has a translation for every navigation label and route title', () => {
    const module = features[0];
    const keys = [
      ...(module?.nav ?? []).map((item) => item.label),
      ...(module?.routes ?? []).map((route) => route.title ?? ''),
    ];
    expect(keys.filter((key) => !hasTranslation(key))).toEqual([]);
  });
});

describe('evaluation catalog coverage', () => {
  const sources = import.meta.glob<string>(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  it('has a translation for every literal key the feature passes to t()', () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      for (const match of text.matchAll(/\bt\(\s*'(evaluation\.[\w.]+)'/g)) {
        const key = match[1] ?? '';
        if (!hasTranslation(key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has a translation for every value of the templated keys', () => {
    const templated = {
      stage: [
        'individual_assessment',
        'moderation',
        'commercial_comparison',
        'ranking',
        'signoff',
        'complete',
      ],
      myNext: [...EVALUATION_NEXT_ACTIONS],
      role: ['chair', 'evaluator', 'commercial_reviewer', 'observer'],
      nextAction: [
        'accept',
        'await_conflict_review',
        'score',
        'submit',
        'correct',
        'commercial_comparison',
        'none',
      ],
      blocked: [
        'not_accepted',
        'undertaking_missing',
        'conflict_pending_review',
        'recused',
        'reassigned',
      ],
      'priceGate.state': ['not_applicable', 'closed', 'released'],
      'priceGate.explain': ['not_applicable', 'closed', 'released'],
      'commercial.state': ['not_started', 'draft', 'approved'],
      'commercial.correction': ['none', 'pending_approval', 'approved'],
      'commercial.abnormal': ['pending', 'explanation_accepted', 'referred_for_decision'],
      'results.state': ['not_computed', 'draft', 'signed_off', 'superseded'],
      'results.next': ['none', 'draft', 'in_signoff', 'signed_off', 'superseded'],
      'assessment.peers': PEER_SCORE_VISIBILITIES.filter((value) => value !== 'visible'),
      'results.gateFailure': [...GATE_FAILURE_CODES, 'other'],
      'results.detail': RESULT_DETAIL_LEVELS.filter((value) => value !== 'full').flatMap(
        (value) => [`${value}.title`, `${value}.body`],
      ),
      'assessment.blocked': ['ASSESSMENT_CONTENT_BLOCKED', 'COMMERCIAL_ASSIGNMENT'],
    };
    const missing = Object.entries(templated).flatMap(([prefix, values]) =>
      values.map((value) => `evaluation.${prefix}.${value}`).filter((key) => !hasTranslation(key)),
    );
    expect(missing).toEqual([]);
  });
});

describe('evaluation business error messages', () => {
  it('has a message for every business error code of the contract', () => {
    const codes = new Set(
      Object.values(evaluationEndpoints).flatMap((endpoint) => [...endpoint.errors]),
    );
    expect([...codes].filter((code) => !hasTranslation(`evaluation.errors.${code}`))).toEqual([]);
  });
});
