// Tagged logger, shared by every package that bundles core. The base call
// (log(...)) is debug-gated so production builds dead-code-eliminate it
// (esbuild inlines __DEBUG__=false). `warn` and `error` always log — they
// signal real problems and should be visible in prod.
//
// Relies on the `__DEBUG__` global, which each consumer's esbuild config
// defines (see core/src/ambient.d.ts for the declaration).

export interface Logger {
  (...args: unknown[]): void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

// All client console tags follow the "[sniffies-<name>]" format.
export const formatTag = (name: string): string => `[sniffies-${name}]`;

export const createLogger = (name: string): Logger => {
  const tag = formatTag(name);
  const log = ((...args: unknown[]): void => {
    if (__DEBUG__) {
      console.log(tag, ...args);
    }
  }) as Logger;
  log.warn = (...args: unknown[]): void => {
    console.warn(tag, ...args);
  };
  log.error = (...args: unknown[]): void => {
    console.error(tag, ...args);
  };
  return log;
};
