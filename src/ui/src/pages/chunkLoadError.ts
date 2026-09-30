/**
 * Recognizes a lazy page module (a dynamic import) that could not be fetched or evaluated, across browsers. Such a
 * failure is cached by the module loader until the document reloads, so the route error page asks for a reload.
 */
/** Messages browsers use for a dynamic import (lazy page chunk) that could not be fetched or evaluated. */
const CHUNK_LOAD_PATTERNS: readonly RegExp[] = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /unable to preload css/i,
];

/** True when the error is a page module that could not be loaded. */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message;
  return CHUNK_LOAD_PATTERNS.some((pattern) => pattern.test(message));
}
