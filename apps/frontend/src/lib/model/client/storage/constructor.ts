import { Storage } from "$model/client/storage/definition";
import { decode } from "$model/client/storage/methods/serialize";
import type { ClientStorage, PersistedClient, Sink } from "$model/client/storage/types";
import { EMPTY, storageKey } from "$model/client/storage/types";

/**
 * Builds storage over a document and a sink. Both are parameters, so a test
 * constructs one directly with a fake sink and never touches `localStorage`.
 */
export const createStorage = (initial: PersistedClient, sink: Sink): ClientStorage =>
  new Storage(initial, sink);

/**
 * Builds storage over this project's `localStorage` key.
 *
 * The key is per project because everything persisted is workbench state and a
 * workbench belongs to a project. Two windows on the same project share the key
 * and the last write wins; that is correct, because they are the same workbench.
 *
 * `window` is read directly rather than behind a guard. `/app` exports
 * `ssr = false`, so nothing on the server reaches this — and a guard for a path
 * that cannot run obscures which constraints are load-bearing.
 */
export const createBrowserStorage = (project: string): ClientStorage =>
  createStorage(read(project), write(project));

/**
 * `localStorage` throws rather than returning null when it is unavailable —
 * Safari's private mode historically, and any browser with site data blocked.
 * A reader that cannot read is the same case as an empty store.
 */
const read = (project: string): PersistedClient => {
  try {
    return decode(window.localStorage.getItem(storageKey(project)));
  } catch {
    return EMPTY;
  }
};

/**
 * A writer that cannot write must not take the application down over a panel
 * width, so a quota failure or a disabled store costs the next reload's tab
 * list and nothing else.
 */
const write =
  (project: string): Sink =>
  (serialized) => {
    try {
      window.localStorage.setItem(storageKey(project), serialized);
    } catch {
      // Quota exceeded, or storage disabled. Losing the next reload's tab list
      // is not worth an exception in the middle of a drag.
    }
  };
