import { describe, expect, it } from 'vitest';

import { inline, parseBlocks } from './markdown';

describe('help article Markdown reader', () => {
  it('splits headings, paragraphs and bullet and numbered lists into blocks', () => {
    expect(parseBlocks('# Title\n\nFirst line\nsecond line\n\n- a\n- b\n\n1. one\n2. two')).toEqual(
      [
        { kind: 'heading', level: 2, text: 'Title' },
        { kind: 'paragraph', text: 'First line second line' },
        { kind: 'list', ordered: false, items: ['a', 'b'] },
        { kind: 'list', ordered: true, items: ['one', 'two'] },
      ],
    );
  });

  it('keeps link text and drops emphasis markers without producing HTML', () => {
    expect(inline('See **the** [guide](https://x.example) and `code`')).toBe(
      'See the guide and code',
    );
  });
});
