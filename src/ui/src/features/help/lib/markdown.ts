/** A small Markdown reader for help articles: headings, paragraphs and lists, as data (never HTML). */
export type Block =
  | { readonly kind: 'heading'; readonly level: 2 | 3; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'list'; readonly ordered: boolean; readonly items: string[] };

/** Splits Markdown into blocks. Exported for tests. */
export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = (): void => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (list !== null) {
      blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
      list = null;
    }
  };
  for (const raw of markdown.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(line);
    if (line === '') {
      flush();
    } else if (heading !== null) {
      flush();
      blocks.push({
        kind: 'heading',
        level: (heading[1] ?? '').length <= 2 ? 2 : 3,
        text: heading[2] ?? '',
      });
    } else if (bullet !== null || numbered !== null) {
      const ordered = numbered !== null;
      if (paragraph.length > 0) {
        blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
        paragraph = [];
      }
      if (list === null || list.ordered !== ordered) {
        if (list !== null) blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
        list = { ordered, items: [] };
      }
      list.items.push((bullet?.[1] ?? numbered?.[1] ?? '').trim());
    } else {
      if (list !== null) {
        blocks.push({ kind: 'list', ordered: list.ordered, items: list.items });
        list = null;
      }
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

/** Strips inline emphasis markers (`**bold**`, `_italic_`, backticks) and keeps link text. */
export function inline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(\*|_)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1');
}
