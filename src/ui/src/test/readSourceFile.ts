/**
 * Reads a source file next to a test. Vitest processes CSS imports to empty strings, so stylesheet contract tests
 * read the file itself. Tests run in Node, but the SPA tsconfig carries no Node types, hence the narrow local type.
 */
interface NodeFs {
  readFileSync(path: string, encoding: 'utf8'): string;
}

export async function readSourceFile(relative: string, importMetaUrl: string): Promise<string> {
  const specifier = 'node:fs';
  const fs = (await import(/* @vite-ignore */ specifier)) as NodeFs;
  const path = decodeURIComponent(new URL(relative, importMetaUrl).pathname).replace(
    /^\/([A-Za-z]:)/,
    '$1',
  );
  return fs.readFileSync(path, 'utf8');
}
