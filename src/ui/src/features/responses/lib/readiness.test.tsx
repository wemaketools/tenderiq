import { describe, expect, it } from 'vitest';

import type { ReadinessItem } from '@contracts/bids';

import { toChecklistItems } from './readiness';

function authority(severity: ReadinessItem['severity']): ReadinessItem {
  return {
    id: `authority-${severity}`,
    category: 'authority',
    severity,
    code: 'SUBMIT_AUTHORITY_MISSING',
    count: null,
    subject: severity === 'blocking' ? '' : 'Motsamai Tsodilo',
    requirementIds: [],
    link: '/supplier/responses/14/submit',
  };
}

const evidence: ReadinessItem = {
  id: 'evidence-1',
  category: 'evidence',
  severity: 'blocking',
  code: 'EVIDENCE_EXPIRED',
  count: null,
  subject: 'Tax clearance certificate',
  requirementIds: [],
  link: '/supplier/responses/14/declarations',
};

describe('toChecklistItems', () => {
  it('leaves out the viewer’s own missing submit permission when others in the organization may submit', () => {
    // Arrange
    const items = [evidence, authority('warning')];

    // Act
    const result = toChecklistItems(items);

    // Assert
    expect(result.map((item) => item.id)).toEqual(['evidence-1']);
  });

  it('keeps the blocking finding when nobody in the organization may submit', () => {
    // Arrange
    const items = [authority('blocking')];

    // Act
    const result = toChecklistItems(items);

    // Assert
    expect(result.map((item) => item.id)).toEqual(['authority-blocking']);
  });
});
