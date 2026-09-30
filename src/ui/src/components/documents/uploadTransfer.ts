/**
 * The byte transfer of the two-step upload envelope (docs/technical/07-api.md §3.5): PUT the file to the signed
 * upload URL with the returned headers, reporting progress.
 *
 * In the Stage A prototype (`environment.mode = 'prototype'`) the mock API returns a contract-valid envelope whose
 * URL is not a storage location, and nothing persists, so the transfer is skipped and the version is confirmed
 * directly. Stage B (B1 `ui-live-api`) serves real signed URLs and this function performs the PUT.
 */
import type { UploadTarget } from '@contracts/documents';

export function transferBytes(
  target: UploadTarget,
  file: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(target.method, target.url);
    for (const [name, value] of Object.entries(target.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(event.loaded / event.total);
      }
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(1);
        resolve();
      } else {
        reject(new Error(`The upload was refused (HTTP ${request.status}).`));
      }
    };
    request.onerror = () => reject(new Error('The upload could not reach the storage service.'));
    request.send(file);
  });
}
