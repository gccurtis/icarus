import type { Logger as PinoRootLogger } from "pino";
import type { ClosableLogStream } from "#observability/types/log-destination.js";

/**
 * Flushes the root Pino logger and resolves once the write has been accepted.
 *
 * Pino buffers, so a runtime that exits without this can lose the last records
 * it wrote — including the failure that caused the exit.
 */
const flushRootLogger = (root: PinoRootLogger): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    root.flush((error?: Error): void => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

/** Ends a stream this runtime opened, resolving once the file is closed. */
const endStream = (stream: ClosableLogStream): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.once("close", resolve);
    stream.end();
  });

/**
 * Releases the runtime's logging output: flush what is buffered, then close the
 * file if this runtime opened one.
 *
 * The order matters — ending a stream before flushing can drop records that
 * Pino has accepted but not yet written. A piped destination has no stream to
 * end, and must not acquire one: closing file descriptor 1 or 2 would take
 * stdout or stderr away from the rest of the process.
 */
export const closeRootLogger = async (
  root: PinoRootLogger,
  stream?: ClosableLogStream
): Promise<void> => {
  await flushRootLogger(root);

  if (stream) {
    await endStream(stream);
  }
};
