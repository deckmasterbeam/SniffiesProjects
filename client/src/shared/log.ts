// Tagged logger. The base call (log(...)) is debug-gated so production builds
// dead-code-eliminate it (esbuild inlines DEBUG=false). `warn` and `error`
// always log — they signal real problems and should be visible in prod.

import { DEBUG } from "./env.js";

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
    if (DEBUG) {
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
