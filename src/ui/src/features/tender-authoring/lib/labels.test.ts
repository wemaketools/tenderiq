import { describe, expect, it } from 'vitest';

import { currenciesText, languageName, languageNames } from './labels';

describe('tender authoring labels', () => {
  it('names catalog languages in words and falls back to the platform name for others', () => {
    expect(languageName('tn')).toBe('Setswana');
    expect(languageNames(['en', 'tn'])).toBe('English, Setswana');
    expect(languageName('fr')).toBe('French');
  });

  it('shows the tender currency once, with any other accepted currencies after it', () => {
    expect(currenciesText('BWP', ['BWP'])).toBe('BWP only');
    expect(currenciesText('BWP', ['BWP', 'ZAR', 'USD'])).toBe('BWP; also accepted: ZAR, USD');
  });
});
