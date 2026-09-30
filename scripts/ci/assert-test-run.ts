/**
 * Asserts that a Vitest run was complete (architecture-plan §8 "CI floors"; brief §4.3 `ci:test`, `ci:test:ui`).
 *
 * Reads the JSON report of `vitest --reporter=json --outputFile.json=<file>` and fails when:
 * - the report is missing or unreadable, or the run did not succeed;
 * - any test failed, or was skipped, pending or todo (skips hide regressions);
 * - fewer than `--min-tests` tests ran (a floor that catches silently dropped suites).
 *
 * Usage: tsx scripts/ci/assert-test-run.ts --report .test-results/vitest-ui.json --min-tests 1
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export interface AssertionResult {
  readonly status: string;
  readonly fullName?: string;
  readonly title?: string;
}

export interface VitestJsonReport {
  readonly success?: boolean;
  readonly numTotalTests?: number;
  readonly numPassedTests?: number;
  readonly numFailedTests?: number;
  readonly numPendingTests?: number;
  readonly numTodoTests?: number;
  readonly testResults?: ReadonlyArray<{ readonly name?: string; readonly status?: string; readonly assertionResults?: readonly AssertionResult[] }>;
}

export interface RunVerdict {
  readonly ok: boolean;
  readonly total: number;
  readonly passed: number;
  readonly problems: string[];
}

/** Evaluates a report against the floor. */
export function evaluateReport(report: VitestJsonReport, minTests: number): RunVerdict {
  const problems: string[] = [];
  const assertions = (report.testResults ?? []).flatMap((file) =>
    (file.assertionResults ?? []).map((assertion) => ({ ...assertion, file: file.name ?? '(unknown file)' })),
  );
  const total = report.numTotalTests ?? assertions.length;
  const passed = report.numPassedTests ?? assertions.filter((assertion) => assertion.status === 'passed').length;
  const failed = assertions.filter((assertion) => assertion.status === 'failed');
  const skipped = assertions.filter((assertion) => ['skipped', 'pending', 'todo', 'disabled'].includes(assertion.status));
  const failedFiles = (report.testResults ?? []).filter((file) => file.status === 'failed');

  if (report.success === false || (report.numFailedTests ?? 0) > 0 || failed.length > 0 || failedFiles.length > 0) {
    problems.push(`${Math.max(report.numFailedTests ?? 0, failed.length)} failed test(s), ${failedFiles.length} failed file(s)`);
  }
  const skipCount = Math.max((report.numPendingTests ?? 0) + (report.numTodoTests ?? 0), skipped.length);
  if (skipCount > 0) {
    const names = skipped.slice(0, 10).map((assertion) => `${assertion.file}: ${assertion.fullName ?? assertion.title ?? ''}`);
    problems.push(`${skipCount} skipped/pending/todo test(s) (not allowed): ${names.join('; ')}`);
  }
  if (total < minTests) {
    problems.push(`only ${total} test(s) ran; the floor is ${minTests}`);
  }
  if (passed !== total && problems.length === 0) {
    problems.push(`${total - passed} test(s) did not pass`);
  }
  return { ok: problems.length === 0, total, passed, problems };
}

function parseArgs(argv: readonly string[]): { report: string; minTests: number } {
  let report: string | null = null;
  let minTests = 1;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];
    if (arg === '--report') {
      if (value === undefined) throw new Error('--report needs a file.');
      report = value;
      index += 1;
    } else if (arg === '--min-tests') {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0) throw new Error('--min-tests needs a non-negative integer.');
      minTests = parsed;
      index += 1;
    } else {
      throw new Error(`Unknown argument "${arg ?? ''}". Usage: assert-test-run.ts --report <file> [--min-tests <n>]`);
    }
  }
  if (report === null) {
    throw new Error('--report is required.');
  }
  return { report: resolve(report), minTests };
}

function main(): void {
  const { report, minTests } = parseArgs(process.argv.slice(2));
  if (!existsSync(report)) {
    process.stderr.write(`assert-test-run: report ${report} not found (did the test run write it?).\n`);
    process.exitCode = 1;
    return;
  }
  const verdict = evaluateReport(JSON.parse(readFileSync(report, 'utf8')) as VitestJsonReport, minTests);
  if (!verdict.ok) {
    process.stderr.write(`assert-test-run: ${verdict.problems.join('\n  ')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`assert-test-run: ${verdict.passed}/${verdict.total} tests passed, none skipped (floor ${minTests}).\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`assert-test-run failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
