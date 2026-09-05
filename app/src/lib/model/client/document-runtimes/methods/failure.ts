import type { Runtime } from "$model/client/document-runtimes/definition.svelte";
import { sync } from "$model/client/document-runtimes/methods/sync";

/**
 * Explicitly abandons the failed gesture and every later local edit built on
 * top of it, then reloads the canonical leader. Nothing is discarded merely
 * because a server refusal arrived; this method is the user's recovery choice.
 */
export const discardFailedChanges = async (runtime: Runtime): Promise<void> => {
  if (runtime.failure === undefined) return;

  runtime.clearTimer();
  runtime.failure = undefined;
  runtime.buffer = [];
  runtime.undoStack = [];
  runtime.redoStack = [];
  runtime.sync = "loading";

  await sync(runtime);
};
