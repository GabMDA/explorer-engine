import { runtimeConsole } from '../internal/console';

/** Severity levels. `silent` disables all output. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/** A single structured log record handed to the sink. */
export interface LogEntry {
  readonly level: Exclude<LogLevel, 'silent'>;
  readonly message: string;
  readonly namespace?: string;
  readonly context?: unknown;
  readonly timestamp: number;
}

/** Destination for log entries. Injectable for testing and for host integration. */
export type LogSink = (entry: LogEntry) => void;

export interface LoggerOptions {
  /** Minimum level emitted. Defaults to `info`. */
  level?: LogLevel;
  /** Optional namespace prefix (e.g. a module or plugin id). */
  namespace?: string;
  /** Where entries go. Defaults to the runtime console. */
  sink?: LogSink;
}

/** Structured, level-filtered logger (chapter 02 §2.19.3). Headless. */
export interface Logger {
  readonly level: LogLevel;
  debug(message: string, context?: unknown): void;
  info(message: string, context?: unknown): void;
  warn(message: string, context?: unknown): void;
  error(message: string, context?: unknown): void;
  /** Change the minimum level at runtime. */
  setLevel(level: LogLevel): void;
  /** Derive a logger with an appended namespace, sharing this sink. */
  child(namespace: string): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const defaultSink: LogSink = (entry) => {
  const console = runtimeConsole();
  if (console === undefined) return;
  const args: unknown[] =
    entry.namespace !== undefined ? [`[${entry.namespace}]`, entry.message] : [entry.message];
  if (entry.context !== undefined) args.push(entry.context);
  console[entry.level](...args);
};

export function createLogger(options: LoggerOptions = {}): Logger {
  let level: LogLevel = options.level ?? 'info';
  const namespace = options.namespace;
  const sink = options.sink ?? defaultSink;

  const write = (entryLevel: Exclude<LogLevel, 'silent'>, message: string, context?: unknown) => {
    if (LEVEL_ORDER[entryLevel] < LEVEL_ORDER[level]) return;
    sink({
      level: entryLevel,
      message,
      timestamp: Date.now(),
      ...(namespace !== undefined ? { namespace } : {}),
      ...(context !== undefined ? { context } : {}),
    });
  };

  return {
    get level() {
      return level;
    },
    debug: (message, context) => write('debug', message, context),
    info: (message, context) => write('info', message, context),
    warn: (message, context) => write('warn', message, context),
    error: (message, context) => write('error', message, context),
    setLevel: (next) => {
      level = next;
    },
    child: (childNamespace) =>
      createLogger({
        level,
        namespace: namespace !== undefined ? `${namespace}:${childNamespace}` : childNamespace,
        sink,
      }),
  };
}
