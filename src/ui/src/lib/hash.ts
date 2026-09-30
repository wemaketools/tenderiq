/**
 * SHA-256 of a file or buffer with WebCrypto, as lowercase hex (the `Sha256` contract format). Upload envelopes
 * send the digest when the upload is created and again when it is confirmed (docs/technical/07-api.md §3.5).
 */

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readBytes(source: Blob): Promise<ArrayBuffer> {
  if (typeof source.arrayBuffer === 'function') {
    return source.arrayBuffer();
  }
  return new Response(source).arrayBuffer();
}

/** Lowercase hex SHA-256 digest. */
export async function sha256Hex(source: Blob | ArrayBuffer): Promise<string> {
  const bytes = source instanceof ArrayBuffer ? source : await readBytes(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return toHex(digest);
}
