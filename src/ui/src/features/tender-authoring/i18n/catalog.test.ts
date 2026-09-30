/**
 * Every literal `tender-authoring.*` key used by the feature exists in its catalog (plural keys through their
 * `_other` form), and every business error code of the tenders contract has a translated message.
 */
import { describe, expect, it } from 'vitest';

import { tenderEndpoints } from '@contracts/tenders';

import { hasTranslation } from '../../../lib/i18n';

const sources = import.meta.glob<string>(
  ['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test.tsx'],
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
);

describe('tender-authoring catalog', () => {
  it('contains every literal key used by the feature when the sources are scanned', () => {
    const used = new Set<string>();
    for (const text of Object.values(sources)) {
      for (const match of text.matchAll(/'(tender-authoring\.[A-Za-z0-9_.]+)'/g)) {
        const key = match[1];
        if (key !== undefined) used.add(key);
      }
    }

    const missing = [...used].filter((key) => !hasTranslation(key));

    expect(used.size).toBeGreaterThan(300);
    expect(missing).toEqual([]);
  });

  it('translates every declared business error code of the tenders contract', () => {
    const codes = new Set(
      Object.values(tenderEndpoints).flatMap((endpoint) => [...endpoint.errors]),
    );

    const missing = [...codes].filter((code) => !hasTranslation(`tender-authoring.errors.${code}`));

    expect(missing).toEqual([]);
  });
});
