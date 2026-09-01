import type { Runtime } from "$model/client/spreadsheet-runtimes/definition.svelte";
import { coalesce } from "$model/client/spreadsheet-runtimes/methods/flush/coalesce";

export const flush = (runtime: Runtime): Promise<void> => {
  runtime.pendingFlush ??= submit(runtime).finally(() => {
    runtime.pendingFlush = undefined;
    runtime.inFlight = false;
  });

  return runtime.pendingFlush;
};

const submit = async (runtime: Runtime): Promise<void> => {
  runtime.clearTimer();
  if (runtime.buffer.length === 0) return;

  const ops = coalesce(runtime.buffer);
  runtime.buffer = [];

  runtime.inFlight = true;
  runtime.sync = "saving";

  try {
    // Not built: nothing writes spreadsheetChangeSets yet.
    const accepted = { revision: runtime.revision + 1 };
    runtime.revision = accepted.revision;

    runtime.sync = runtime.buffer.length === 0 ? "saved" : "saving";
  } catch (error) {
    runtime.buffer = [...ops, ...runtime.buffer];
    runtime.sync = "error";

    throw error;
  }
};
