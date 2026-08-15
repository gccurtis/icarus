import assert from "node:assert/strict";
import { test } from "vitest";
import type { Logger as PinoRootLogger } from "pino";
import type { ClosableLogStream } from "$model/server/observability/types";
import { PinoObservability } from "$model/server/observability/definition";

/**
 * Shutdown order is the whole of this object's terminal behaviour, and it is
 * invisible in the code: a flush and an end read as two independent awaits until
 * you know that Pino buffers.
 */

/** A root logger that records when it was flushed. */
const fakeRoot = (order: string[]): PinoRootLogger =>
  ({
    flush: (callback: (error?: Error) => void) => {
      order.push("flush");
      callback();
    }
  }) as unknown as PinoRootLogger;

/** A stream that records when it was ended and reports itself closed. */
const fakeStream = (order: string[]): ClosableLogStream => {
  const listeners = new Map<string, () => void>();
  return {
    end: () => {
      order.push("end");
      listeners.get("close")?.();
    },
    once: (event: string, listener: () => void) => listeners.set(event, listener)
  } as ClosableLogStream;
};

test("flushes before ending the stream", async () => {
  // The reverse order drops the records Pino has accepted but not yet written —
  // usually including the failure that caused the shutdown.
  const order: string[] = [];
  const observability = new PinoObservability(fakeRoot(order), fakeStream(order));

  await observability.close();

  assert.deepEqual(order, ["flush", "end"]);
});

test("a piped destination is flushed and never ended", async () => {
  // Ending descriptor 1 or 2 would take stdout away from everything else in the
  // process, so the object holds no stream at all when it opened none.
  const order: string[] = [];
  const observability = new PinoObservability(fakeRoot(order));

  await observability.close();

  assert.deepEqual(order, ["flush"]);
});

test("a failed flush is reported rather than swallowed", async () => {
  const root = {
    flush: (callback: (error?: Error) => void) => callback(new Error("disk was full"))
  } as unknown as PinoRootLogger;

  await assert.rejects(new PinoObservability(root).close(), /disk was full/);
});
