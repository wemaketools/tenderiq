import { describe, expect, it } from 'vitest';

import { hasTranslation } from '../../../lib/i18n';

const sources = import.meta.glob<string>(
  ['../**/*.ts', '../**/*.tsx', '!../**/*.test.*', '!../test/**'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

describe('contracts catalog', () => {
  it('has an entry for every literal contracts key used by the feature', () => {
    const missing: string[] = [];
    let found = 0;
    for (const [file, source] of Object.entries(sources)) {
      for (const match of source.matchAll(/\bt\(\s*'(contracts\.[A-Za-z0-9_.-]+)'/g)) {
        const key = match[1];
        found += 1;
        if (key !== undefined && !hasTranslation(key)) missing.push(`${file}: ${key}`);
      }
    }
    expect(Object.keys(sources).length).toBeGreaterThan(20);
    expect(found).toBeGreaterThan(300);
    expect(missing).toEqual([]);
  });

  it('has an entry for every templated screen, decision and milestone key', () => {
    const keys = [
      ...[
        'CON-02',
        'CON-03',
        'CON-04',
        'CON-05',
        'CON-06',
        'CON-07',
        'CON-08',
        'CON-09',
        'CON-10',
        'CON-11',
      ].map((id) => `contracts.screens.${id}`),
      ...[
        'difference_approval',
        'review_approval',
        'signature',
        'commencement',
        'handover_acceptance',
        'renewal_notice',
        'change_approval',
        'security_expiry',
        'closeout',
      ].map((kind) => `contracts.decision.${kind}`),
      ...['signed', 'effective', 'notice_to_proceed', 'delivery_start', 'handover_accepted'].map(
        (key) => `contracts.milestone.${key}`,
      ),
      ...['not_open', 'open', 'closed'].map((state) => `contracts.renewals.window.${state}`),
      ...['approve', 'reject', 'return'].map(
        (decision) => `contracts.changes.decision.${decision}`,
      ),
    ];
    expect(keys.filter((key) => !hasTranslation(key))).toEqual([]);
  });
});
