/**
 * Browser downloads. Business-readable exports are produced by the server (xlsx, csv, print-styled html); the SPA
 * only hands a server-issued signed URL or a received Blob to the browser (docs/technical/09-frontend.md §1).
 */

function clickAnchor(href: string, fileName: string | undefined): void {
  const anchor = document.createElement('a');
  anchor.href = href;
  if (fileName !== undefined) {
    anchor.download = fileName;
  }
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

/** Saves a Blob under a file name. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    clickAnchor(url, fileName);
  } finally {
    // Revoke on the next tick: the click has started the download by then.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/**
 * Opens a server-issued, short-lived download URL (for example from `me.documents.download`). Relative URLs stay
 * on the app origin; absolute URLs must be http(s).
 */
export function downloadFromUrl(url: string, fileName?: string): void {
  const resolved = new URL(url, window.location.origin);
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    throw new Error(`Refusing to download from a ${resolved.protocol} URL.`);
  }
  clickAnchor(resolved.toString(), fileName);
}

/** Quotes one CSV cell (RFC 4180). */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  // Neutralize spreadsheet formula injection in exported text.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Builds CSV text from a header row and data rows. */
export function toCsv(
  header: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

/** Saves CSV text as a UTF-8 file (with BOM so spreadsheet tools detect the encoding). */
export function downloadCsv(fileName: string, csv: string): void {
  downloadBlob(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }), fileName);
}
