import type { Logger as PinoRootLogger } from "pino";

/**
 * Flushes the root Pino logger and resolves once the write has been accepted.
 *
 * Pino buffers, so a runtime that exits without this can lose the last records
 * it wrote — including the failure that caused the exit.
 */
export const flushRootLogger = (root: PinoRootLogger): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    root.flush((error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
