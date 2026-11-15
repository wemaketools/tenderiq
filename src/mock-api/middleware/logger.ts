/**
 * Structured logger of the mock API (mirrors brief §5.5): one JSON object per line, with timestamp, level,
 * message, env and correlationId plus a context object. Every value passes through `redact`, which masks
 * sensitive keys (token, authorization, password, secret, key, cookie, email…) and scrubs JWT-shaped substrings,
 * so tokens, keys and personal data never reach the log.
 */
/** Log levels, in increasing severity (the values of `LOG_LEVEL`, brief §5.4). */
export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

/** Receives one serialized log line (without the trailing newline). */
export type LogSink = (line: string) => void;

export interface MockLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  /** A logger whose lines carry `bindings` (for example the correlation id). */
  child(bindings: Record<string, unknown>): MockLogger;
}

const LEVEL_RANK: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const SENSITIVE_KEY = /(token|authorization|password|passwd|secret|api[-_]?key|apikey|service[-_]?role|cookie|session|e-?mail|phone|jwt|bearer|credential)/i;
const JWT_LIKE = /eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const SECRET_LIKE = /\b(sb_secret_|sb_publishable_)[A-Za-z0-9_-]+/g;
const EMAIL_LIKE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const REDACTED = '[REDACTED]';

/** Masks sensitive members and secret-looking substrings, recursively. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return '[TRUNCATED]';
  }
  if (typeof value === 'string') {
    return value.replace(JWT_LIKE, REDACTED).replace(SECRET_LIKE, REDACTED).replace(EMAIL_LIKE, REDACTED);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (value instanceof Error) {
    return { name: value.name, message: redact(value.message, depth + 1) };
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(member, depth + 1);
    }
    return out;
  }
  return value;
}

/** Writes each line to the console as a warning (the in-browser prototype logs at `warn` and above). */
export const consoleSink: LogSink = (line) => {
  console.warn(line);
};

export interface LoggerOptions {
  readonly sink?: LogSink | undefined;
  readonly level?: LogLevel;
  readonly env?: string;
  readonly bindings?: Record<string, unknown>;
}

/** Creates a logger (default sink: the console, level `info`). */
export function createLogger(options: LoggerOptions = {}): MockLogger {
  const sink = options.sink ?? consoleSink;
  const threshold = LEVEL_RANK[options.level ?? 'info'];
  const env = options.env ?? 'local';
  const bindings = options.bindings ?? {};

  function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < threshold) {
      return;
    }
    const { correlationId, ...rest } = bindings;
    const line = {
      timestamp: new Date().toISOString(),
      level,
      message: redact(message),
      env,
      correlationId: typeof correlationId === 'string' ? correlationId : undefined,
      context: redact({ ...rest, ...(context ?? {}) }),
    };
    sink(JSON.stringify(line));
  }

  return {
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
    child: (extra) => createLogger({ sink, level: options.level ?? 'info', env, bindings: { ...bindings, ...extra } }),
  };
}
