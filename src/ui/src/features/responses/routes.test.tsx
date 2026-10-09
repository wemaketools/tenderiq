import { describe, expect, it } from 'vitest';

import { bidEndpoints } from '@contracts/bids';
import { BID_DECLARATIONS_DECLARATION_TYPE, BID_INTERNAL_APPROVALS_STATUS } from '@contracts/enums';
import {
  CLOSE_BLOCKERS,
  CLOSING_STATUSES,
  EFFECTIVE_OFFER_EXPLANATIONS,
  INTERNAL_APPROVAL_DECISIONS,
  PRICING_ISSUE_CODES,
  READINESS_CATEGORIES,
  READINESS_CODES,
  SUBMIT_BLOCK_REASONS,
} from '@contracts/bids';

import { navGroupsFor } from '../../app/featureRegistry';
import { hasTranslation } from '../../lib/i18n';
import { features as monitoringFeatures } from '../submission-monitoring/routes';
import { features } from './routes';

const navIds = (kind: 'buyer' | 'supplier', permissions: readonly string[]): string[] =>
  navGroupsFor([...features, ...monitoringFeatures], { tenantKind: kind, permissions }).flatMap(
    (group) => group.items.map((item) => item.id),
  );

describe('responses and submission-monitoring navigation', () => {
  it('shows responses and receipts to the supplier response team', () => {
    // Act
    const ids = navIds('supplier', ['supplier.response.edit']);

    // Assert
    expect(ids).toEqual(expect.arrayContaining(['supplier.responses', 'supplier.receipts']));
    expect(ids).not.toContain('buyer.submissions');
  });

  it('shows only receipts to a supplier administrator without response access', () => {
    // Act
    const ids = navIds('supplier', ['supplier.outcomes.view']);

    // Assert
    expect(ids).toContain('supplier.receipts');
    expect(ids).not.toContain('supplier.responses');
  });

  it('shows submission monitoring to buyers holding bid.monitor and hides it otherwise', () => {
    expect(navIds('buyer', ['bid.monitor'])).toContain('buyer.submissions');
    expect(navIds('buyer', ['tender.view'])).not.toContain('buyer.submissions');
  });

  it('guards every workspace route with the response-team permission set', () => {
    // Arrange
    const [module] = features;

    // Act
    const unguarded = (module?.routes ?? []).filter((route) => route.permission === undefined);

    // Assert
    expect(unguarded).toEqual([]);
  });
});

describe('responses catalog coverage', () => {
  const sources = import.meta.glob<string>(
    [
      './**/*.{ts,tsx}',
      '../submission-monitoring/**/*.{ts,tsx}',
      '!./**/*.test.{ts,tsx}',
      '!../submission-monitoring/**/*.test.{ts,tsx}',
    ],
    { query: '?raw', import: 'default', eager: true },
  );

  it('has a translation for every literal key the pages pass to t()', () => {
    // Arrange
    const missing: string[] = [];

    // Act
    for (const [file, text] of Object.entries(sources)) {
      for (const match of text.matchAll(
        /\bt\(\s*'((?:responses|submission-monitoring)\.[\w.-]+)'/g,
      )) {
        const key = match[1] ?? '';
        if (!hasTranslation(key) && !hasTranslation(`${key}_one`)) missing.push(`${file}: ${key}`);
      }
    }

    // Assert
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(missing).toEqual([]);
  });

  it('has a message for every dynamic key family', () => {
    // Arrange
    const keys = [
      ...READINESS_CODES.map((code) => `responses.readiness.code.${code}`),
      ...READINESS_CATEGORIES.flatMap((category) => [
        `responses.readiness.category.${category}`,
        `responses.readiness.passed.${category}`,
      ]),
      ...EFFECTIVE_OFFER_EXPLANATIONS.flatMap((value) => [
        `responses.effective.title.${value}`,
        `responses.effective.detail.${value}`,
      ]),
      ...BID_DECLARATIONS_DECLARATION_TYPE.map((type) => `responses.declarations.text.${type}`),
      ...INTERNAL_APPROVAL_DECISIONS.flatMap((decision) => [
        `responses.review.decision.${decision}`,
        `responses.review.decideTitle.${decision}`,
        `responses.review.decideConsequence.${decision}`,
        `responses.review.decided.${decision}`,
      ]),
      ...BID_INTERNAL_APPROVALS_STATUS.filter((status) => status !== 'pending').map(
        (status) => `responses.review.state.${status}`,
      ),
      // The missing submit permission is not announced (DD-49); the other reasons are.
      ...SUBMIT_BLOCK_REASONS.filter((reason) => reason !== 'SUBMIT_PERMISSION_MISSING').map(
        (reason) => `responses.submit.block.${reason}`,
      ),
      ...PRICING_ISSUE_CODES.map((code) => `responses.pricing.issue.${code}`),
      ...[
        'withdrawn',
        'closedSubmitted',
        'closedNotSubmitted',
        'effectiveNoWork',
        'startWork',
        'completeAnswers',
        'requestApproval',
        'awaitApproval',
        'submit',
        'retrySubmit',
        'reviewHistory',
      ].map((key) => `responses.next.${key}`),
      ...CLOSING_STATUSES.map((status) => `submission-monitoring.closing.${status}`),
      ...CLOSE_BLOCKERS.map((blocker) => `submission-monitoring.close.blocker.${blocker}`),
      ...['monitor', 'close', 'closeByOfficer', 'closed'].map(
        (key) => `submission-monitoring.detail.nextAction.${key}`,
      ),
    ];

    // Act
    const missing = keys.filter((key) => !hasTranslation(key) && !hasTranslation(`${key}_one`));

    // Assert
    expect(missing).toEqual([]);
  });

  it('has a clear message for every business error code of the supplier endpoints', () => {
    // Arrange
    const codes = new Set(
      Object.values(bidEndpoints)
        .filter((endpoint) => endpoint.audience === 'supplier')
        .flatMap((endpoint) => [...endpoint.errors]),
    );

    // Act
    const missing = [...codes].filter((code) => !hasTranslation(`responses.errors.${code}`));

    // Assert
    expect(missing).toEqual([]);
  });

  it('has a clear message for every business error code of the monitoring endpoints', () => {
    // Arrange
    const codes = new Set(
      Object.values(bidEndpoints)
        .filter((endpoint) => endpoint.audience === 'buyer')
        .flatMap((endpoint) => [...endpoint.errors]),
    );

    // Act
    const missing = [...codes].filter(
      (code) => !hasTranslation(`submission-monitoring.errors.${code}`),
    );

    // Assert
    expect(missing).toEqual([]);
  });
});
