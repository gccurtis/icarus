import type { Logger as PinoRootLogger } from "pino";
import type { ClosableLogStream } from "$model/server/observability/types";
import type { ObservabilityState } from "$model/server/observability/definition";

/**
 * Flushes the root logger and resolves once the write has been accepted.
 *
 * Pino buffers, so a process that exits without this loses the last records it
 * wrote — including, usually, the failure that caused the exit.
 */
const flush = (root: PinoRootLogger): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    root.flush((error?: Error): void => {
      if (error) reject(error);
      else resolve();
    });
  });

/** Ends a stream this object opened, resolving once the file is closed. */
const endStream = (stream: ClosableLogStream): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    stream.once("error", reject);
    stream.once("close", resolve);
    stream.end();
  });

/**
 * Flush, then close the file if this object opened one.
 *
 * The order matters: ending a stream before flushing drops records Pino has
 * accepted but not yet written, which is exactly the set a shutdown is being
 * read for. A piped destination leaves no stream to end, so descriptors 1 and 2
 * survive an object that never owned them.
 */
export const close = async (state: ObservabilityState): Promise<void> => {
  await flush(state.root);
  if (state.stream) await endStream(state.stream);
};
