import { describe, expect, it } from 'vitest';

import {
  RESERVED_NAMESPACES,
  featureNamespaceOf,
  hasTranslation,
  registerCatalog,
  t,
  tEnum,
} from './i18n';

describe('t', () => {
  it('interpolates named parameters', () => {
    expect(t('shell.footer.currency', { currency: 'BWP' })).toBe('All amounts in BWP');
  });

  it('chooses the English plural form from count', () => {
    expect(t('ui.readiness.warning', { count: 1 })).toBe('1 warning');
    expect(t('ui.readiness.warning', { count: 3 })).toBe('3 warnings');
  });

  it('returns the key itself for a missing translation', () => {
    expect(t('no.such.key')).toBe('no.such.key');
    expect(hasTranslation('no.such.key')).toBe(false);
  });

  it('namespaces feature catalogs by their directory and flattens nested keys', () => {
    registerCatalog('testfeature', { list: { title: 'Tenders {count}' }, 'flat.key': 'Flat' });
    expect(t('testfeature.list.title', { count: 3 })).toBe('Tenders 3');
    expect(t('testfeature.flat.key')).toBe('Flat');
    expect(featureNamespaceOf('../features/tender-authoring/i18n/en.ts')).toBe('tender-authoring');
    expect(featureNamespaceOf('../features/x/other.ts')).toBeNull();
  });
});

describe('reserved namespaces', () => {
  it('leaves every planned feature directory name free, including the workspace features approvals and documents', () => {
    // Arrange: the feature directories of the domain plan (architecture-plan §5).
    const planned = [
      'tasks',
      'approvals',
      'notifications',
      'documents',
      'calendars',
      'account',
      'admin-org',
    ];
    planned.push(
      'admin-access',
      'admin-policy',
      'supplier-org',
      'supplier-directory',
      'qualification',
      'requests',
    );
    planned.push(
      'planning',
      'tender-authoring',
      'publication',
      'public-portal',
      'opportunities',
      'clarifications',
    );
    planned.push(
      'responses',
      'submission-monitoring',
      'opening',
      'evaluation',
      'selection',
      'awards',
      'outcomes',
    );
    planned.push(
      'contracts',
      'dashboard',
      'reports',
      'records',
      'search',
      'ops',
      'help',
      'admin-integrations',
    );

    // Act
    const clashes = planned.filter((name) =>
      (RESERVED_NAMESPACES as readonly string[]).includes(name),
    );

    // Assert
    expect(clashes).toEqual([]);
  });
});

describe('tEnum', () => {
  it('uses a catalog label when present and the contract label otherwise', () => {
    expect(tEnum('tenders.status', 'closed')).toBe('Closed / awaiting opening');
    registerCatalog('enum', { 'tenders.status': { open: 'Open for responses' } });
    expect(tEnum('tenders.status', 'open')).toBe('Open for responses');
  });
});

describe('shell catalog coverage', () => {
  const sources = import.meta.glob<string>(
    ['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}', '!../features/**'],
    {
      query: '?raw',
      import: 'default',
      eager: true,
    },
  );

  it('has a translation for every literal key the shell passes to t()', () => {
    const missing: string[] = [];
    for (const [file, text] of Object.entries(sources)) {
      for (const match of text.matchAll(/\bt\(\s*'([a-zA-Z][\w.]*)'/g)) {
        const key = match[1] ?? '';
        if (key.split('.').length > 1 && !hasTranslation(key) && !file.endsWith('i18n.ts')) {
          missing.push(`${file}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
