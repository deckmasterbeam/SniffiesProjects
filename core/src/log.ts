export interface Logger {
  (...args: unknown[]): void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

// All console tags have "[sniffies-<name>]" format.
const formatTag = (name: string): string => `[sniffies-${name}]`;

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
