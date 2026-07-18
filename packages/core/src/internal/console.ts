// Runtime-agnostic access to the host console (internal, not part of the public API).
//
// The headless core must not depend on DOM or Node type libraries
// (ENGINE_CONSTITUTION L8/L9), so `console` is not globally typed here. We reach
// it through `globalThis` with a minimal local shape. It works in both browser
// and Node runtimes, and is absent-safe (returns undefined if there is no console).

export interface ConsoleLike {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  log(...args: unknown[]): void;
}

export function runtimeConsole(): ConsoleLike | undefined {
  return (globalThis as { console?: ConsoleLike }).console;
}
