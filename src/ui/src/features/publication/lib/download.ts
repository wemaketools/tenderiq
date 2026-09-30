/**
 * Saves a server-issued download link. The prototype's mock API answers with `data:` URLs carrying the real bytes
 * (the published size and sha256 match); those are decoded into a Blob. Other links go through `downloadFromUrl`.
 */
import type { DownloadLink } from '@contracts/documents';

import { downloadBlob, downloadFromUrl } from '../../../lib/download';

export function saveDownloadLink(link: DownloadLink): void {
  if (link.url.startsWith('data:')) {
    const comma = link.url.indexOf(',');
    const header = link.url.slice(5, comma);
    const payload = link.url.slice(comma + 1);
    const binary = header.endsWith(';base64') ? atob(payload) : decodeURIComponent(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    downloadBlob(new Blob([bytes], { type: link.contentType }), link.fileName);
    return;
  }
  downloadFromUrl(link.url, link.fileName);
}
