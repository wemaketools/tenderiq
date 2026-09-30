/**
 * Renders the small Markdown subset used by buyer guidance and help articles (headings, bullet and numbered lists,
 * paragraphs, **bold** and *italic*) as React elements. No HTML is injected.
 */
import type { ReactNode } from 'react';

type Block =
  | { readonly kind: 'heading'; readonly level: 2 | 3 | 4; readonly text: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: readonly string[] }
  | { readonly kind: 'paragraph'; readonly text: string };

interface ParseState {
  paragraph: string[];
  list: { ordered: boolean; items: string[] } | null;
}

const LINE_BREAK = /\r?\n/;

function flushParagraph(state: ParseState, blocks: Block[]): void {
  if (state.paragraph.length > 0) {
    blocks.push({ kind: 'paragraph', text: state.paragraph.join(' ') });
    state.paragraph = [];
  }
}

function flushList(state: ParseState, blocks: Block[]): void {
  if (state.list !== null) {
    blocks.push({ kind: 'list', ordered: state.list.ordered, items: state.list.items });
    state.list = null;
  }
}

function parse(markdown: string): Block[] {
  const blocks: Block[] = [];
  const state: ParseState = { paragraph: [], list: null };

  for (const raw of markdown.split(LINE_BREAK)) {
    const line = raw.trim();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    const item = /^(?:[-*]|\d+[.)])\s+(.*)$/.exec(line);
    if (line === '') {
      flushParagraph(state, blocks);
      flushList(state, blocks);
    } else if (heading !== null) {
      flushParagraph(state, blocks);
      flushList(state, blocks);
      const level = Math.min(Math.max((heading[1] ?? '#').length + 1, 2), 4) as 2 | 3 | 4;
      blocks.push({ kind: 'heading', level, text: heading[2] ?? '' });
    } else if (item !== null) {
      const ordered = /^\d/.test(line);
      flushParagraph(state, blocks);
      if (state.list !== null && state.list.ordered !== ordered) flushList(state, blocks);
      if (state.list === null) state.list = { ordered, items: [] };
      state.list.items.push(item[1] ?? '');
    } else {
      flushList(state, blocks);
      state.paragraph.push(line);
    }
  }
  flushParagraph(state, blocks);
  flushList(state, blocks);
  return blocks;
}

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter((part) => part !== '');
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <span key={index}>{part}</span>;
  });
}

export function SimpleMarkdown({ markdown }: { readonly markdown: string }) {
  const blocks = parse(markdown);
  return (
    <div className="tiq-stack">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const Heading = `h${block.level}` as 'h2' | 'h3' | 'h4';
          return (
            <Heading key={index} className="tiq-form-section-title">
              {inline(block.text)}
            </Heading>
          );
        }
        if (block.kind === 'list') {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{inline(item)}</li>
          ));
          return block.ordered ? <ol key={index}>{items}</ol> : <ul key={index}>{items}</ul>;
        }
        return <p key={index}>{inline(block.text)}</p>;
      })}
    </div>
  );
}
