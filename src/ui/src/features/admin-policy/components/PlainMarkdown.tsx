/**
 * A safe, minimal reading view of template text written in Markdown style: `#` headings, numbered and bulleted
 * lists, pipe tables and paragraphs separated by blank lines. Everything renders as text (no HTML is interpreted).
 */
import type { ReactNode } from 'react';

type Block =
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'ordered' | 'bullets'; readonly items: string[] }
  | { readonly kind: 'paragraph'; readonly lines: string[] }
  | { readonly kind: 'table'; readonly rows: string[][] };

const ORDERED = /^\d+[.)]\s+/;
const BULLET = /^[-*]\s+/;
const TABLE_SEPARATOR = /^\|?[\s:|-]+\|?$/;

function cells(line: string): string[] {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const last = blocks[blocks.length - 1];
    if (line === '') {
      blocks.push({ kind: 'paragraph', lines: [] });
    } else if (line.startsWith('|')) {
      if (TABLE_SEPARATOR.test(line)) continue;
      if (last !== undefined && last.kind === 'table') last.rows.push(cells(line));
      else blocks.push({ kind: 'table', rows: [cells(line)] });
    } else if (line.startsWith('#')) {
      blocks.push({ kind: 'heading', text: line.replace(/^#+\s*/, '') });
    } else if (ORDERED.test(line) || BULLET.test(line)) {
      const kind = ORDERED.test(line) ? 'ordered' : 'bullets';
      const item = line.replace(ORDERED, '').replace(BULLET, '');
      if (last !== undefined && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else if (last !== undefined && last.kind === 'paragraph') {
      last.lines.push(line);
    } else {
      blocks.push({ kind: 'paragraph', lines: [line] });
    }
  }
  return blocks.filter((block) => block.kind !== 'paragraph' || block.lines.length > 0);
}

export function PlainMarkdown({ text }: { readonly text: string }) {
  return (
    <div className="tiq-stack">
      {parse(text).map((block, index): ReactNode => {
        switch (block.kind) {
          case 'heading':
            return (
              <h3 key={index} className="tiq-card-title">
                {block.text}
              </h3>
            );
          case 'ordered':
            return (
              <ol key={index}>
                {block.items.map((item, position) => (
                  <li key={position}>{item}</li>
                ))}
              </ol>
            );
          case 'bullets':
            return (
              <ul key={index}>
                {block.items.map((item, position) => (
                  <li key={position}>{item}</li>
                ))}
              </ul>
            );
          case 'table': {
            const [head, ...body] = block.rows;
            return (
              <div key={index} className="tiq-table-wrap">
                <table>
                  {head !== undefined && (
                    <thead>
                      <tr>
                        {head.map((cell, position) => (
                          <th key={position} scope="col">
                            {cell}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {body.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {row.map((cell, position) => (
                          <td key={position}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          }
          case 'paragraph':
            return <p key={index}>{block.lines.join(' ')}</p>;
        }
        return null;
      })}
    </div>
  );
}
