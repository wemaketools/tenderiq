/**
 * Layout and accessibility contracts of the component class library that jsdom cannot measure (no layout engine):
 * the rules are asserted on the stylesheet itself. The Playwright prototype project measures the rendered result
 * (e2e_tests/specs/prototype/layout.spec.ts).
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { readSourceFile } from '../test/readSourceFile';

let css = '';

beforeAll(async () => {
  css = await readSourceFile('./components.css', import.meta.url);
});

/**
 * The declarations of every rule (media queries included) whose selector list is exactly `selector`
 * (whitespace-normalised), joined.
 */
function rule(selector: string): string {
  const normalised = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
  const wanted = selector.replace(/\s+/g, ' ').trim();
  const bodies: string[] = [];
  for (const match of normalised.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selectors = '', body = ''] = match;
    if (selectors.trim() === wanted) {
      bodies.push(body);
    }
  }
  if (bodies.length === 0) {
    throw new Error(`No rule for ${selector}`);
  }
  return bodies.join(' ');
}

describe('components.css layout contracts', () => {
  it('contains visually hidden content inside positioned scroll containers so it cannot widen the page', () => {
    for (const selector of ['.tiq-table-wrap', '.tiq-chart', '.tiq-stepper']) {
      expect(rule(selector)).toMatch(/position: relative/);
    }
    expect(rule('.tiq-step')).toMatch(/position: relative/);
  });

  it('spaces the children of a tab panel with the standard page gap', () => {
    const body = rule('.tiq-tabpanel');
    expect(body).toMatch(/display: flex/);
    expect(body).toMatch(/flex-direction: column/);
    expect(body).toMatch(/gap: var\(--tiq-space-4\)/);
  });

  it('drops the own top margin of a spaced stack directly inside a tab panel, so the gap is not doubled', () => {
    expect(rule('.tiq-tabpanel > .tiq-stack--spaced')).toMatch(/margin-top: 0/);
  });

  it('resets list styling on stacks rendered as lists', () => {
    const body = rule('ul.tiq-stack, ol.tiq-stack');
    expect(body).toMatch(/list-style: none/);
    expect(body).toMatch(/padding: 0/);
    expect(body).toMatch(/margin: 0/);
  });

  it('stacks the public header wordmark above its tagline', () => {
    expect(rule('.tiq-public-brand')).toMatch(/flex-direction: column/);
  });

  it('keeps the top bar actions at their size so the title truncates instead', () => {
    expect(rule('.tiq-topbar-actions')).toMatch(/flex: none/);
  });

  it('widens the bar list label column so stage names fit', () => {
    expect(rule('.tiq-barlist-row')).toMatch(/minmax\(96px, 200px\)/);
  });
});

describe('components.css accessibility contracts', () => {
  it('hides the closed navigation drawer from focus and assistive technology', () => {
    const closed = rule('.tiq-sidebar');
    expect(closed).toMatch(/visibility: hidden/);
    expect(rule('.tiq-app--drawer-open .tiq-sidebar')).toMatch(/visibility: visible/);
  });

  it('keeps the focus ring on the selected tab, the current organization and the skip link', () => {
    expect(
      rule(".tiq-tab--active:focus-visible, .tiq-tab[aria-selected='true']:focus-visible"),
    ).toMatch(/var\(--tiq-focus-ring\), var\(--tiq-shadow-card\)/);
    expect(rule('.tiq-org-option--current:focus-visible')).toMatch(/var\(--tiq-focus-ring\)/);
    expect(rule('.tiq-skip-link:focus-visible')).toMatch(/var\(--tiq-focus-ring\)/);
  });

  it('gives readiness detail text and inline actions on tinted items the primary text colour', () => {
    expect(
      rule(
        '.tiq-readiness-item--blocking .tiq-readiness-detail, .tiq-readiness-item--warning .tiq-readiness-detail, .tiq-readiness-item--blocking .tiq-btn--ghost, .tiq-readiness-item--warning .tiq-btn--ghost',
      ),
    ).toMatch(/color: var\(--tiq-text-primary\)/);
  });

  it('underlines links in running text and gives banner links the banner text colour', () => {
    expect(
      rule(
        ':where(p, dd, figcaption, .tiq-banner, .tiq-text-muted, .tiq-field-hint, .tiq-cell-sub) a:not([class])',
      ),
    ).toMatch(/text-decoration: underline/);
    expect(rule('.tiq-banner a:not([class])')).toMatch(/color: inherit/);
  });
});
