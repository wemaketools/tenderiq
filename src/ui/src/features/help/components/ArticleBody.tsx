/**
 * Renders help article Markdown as plain React elements (headings, paragraphs, bullet and numbered lists). Text is
 * never injected as HTML, so article content cannot run script or change the page.
 */
import type { ReactNode } from 'react';

import { inline, parseBlocks } from '../lib/markdown';

export function ArticleBody({ markdown }: { readonly markdown: string }) {
  const content: ReactNode[] = parseBlocks(markdown).map((block, index) => {
    const key = `${block.kind}-${index}`;
    if (block.kind === 'heading') {
      return block.level === 2 ? (
        <h2 key={key}>{inline(block.text)}</h2>
      ) : (
        <h3 key={key}>{inline(block.text)}</h3>
      );
    }
    if (block.kind === 'list') {
      const items = block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>);
      return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
    }
    return <p key={key}>{inline(block.text)}</p>;
  });
  return <div className="tiq-stack">{content}</div>;
}
