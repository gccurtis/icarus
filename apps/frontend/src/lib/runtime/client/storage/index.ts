import { browser } from "$app/environment";
import { decode, encode } from "$runtime/client/storage/serialize";
import type {
  PersistedClient,
  PersistedPreferences,
  PersistedWorkbench
} from "$runtime/client/storage/types";
import { EMPTY, STORAGE_KEY, STORAGE_VERSION } from "$runtime/client/storage/types";

export type {
  PersistedClient,
  PersistedPreferences,
  PersistedTab,
  PersistedWorkbench
} from "$runtime/client/storage/types";

/**
 * What survives a reload.
 *
 * Named `ClientStorage` rather than `Storage`, which is a DOM lib global —
 * `localStorage`'s own type. A local `Storage` interface shadows it inside its
 * own module and silently does *not* in any file that forgets to import ours,
 * which typechecks and means something else entirely.
 *
 * Typed sections rather than a stringly-keyed get/set, so the interface is
 * itself the list of what persists.
 */
export interface ClientStorage {
  readonly preferences: PersistedPreferences | undefined;
  readonly workbench: PersistedWorkbench | undefined;
  savePreferences(value: PersistedPreferences): void;
  saveWorkbench(value: PersistedWorkbench): void;
}

/** Where a write goes. Injected so a test can watch one without a DOM. */
export type Sink = (serialized: string) => void;

class Storage implements ClientStorage {
  #document: PersistedClient;
  #pending = false;

  constructor(
    initial: PersistedClient,
    private readonly sink: Sink
  ) {
    this.#document = initial;
  }

  get preferences(): PersistedPreferences | undefined {
    return this.#document.preferences;
  }

  get workbench(): PersistedWorkbench | undefined {
    return this.#document.workbench;
  }

  savePreferences(value: PersistedPreferences): void {
    this.#document = { ...this.#document, preferences: value };
    this.#schedule();
  }

  saveWorkbench(value: PersistedWorkbench): void {
    this.#document = { ...this.#document, workbench: value };
    this.#schedule();
  }

  /**
   * One write per synchronous burst.
   *
   * Opening a tab touches the tab list and the active ref; without coalescing
   * that is two serializations and two writes for one user action. A microtask
   * rather than a timer, so nothing is ever left pending at unload and there is
   * nothing to close.
   */
  #schedule(): void {
    if (this.#pending) return;
    this.#pending = true;
    queueMicrotask(() => {
      this.#pending = false;
      this.sink(encode(this.#document));
    });
  }
}

/**
 * Builds storage over a document and a sink. Both are parameters, so a test
 * constructs one directly with a fake sink and never touches `localStorage` or
 * `$app/environment`.
 */
export const createStorage = (initial: PersistedClient, sink: Sink): ClientStorage =>
  new Storage(initial, sink);

/** The one storage for this browser. See the guard's reasoning in client.md. */
let instance: ClientStorage | undefined;

export const storage = (): ClientStorage => {
  if (!browser) {
    throw new Error(
      "storage is browser-only. A route that reads it needs `ssr = false` — see " +
        "src/lib/runtime/client/client.md."
    );
  }

  return (instance ??= createStorage(read(), write));
};

/**
 * `localStorage` throws rather than returning null when it is unavailable —
 * Safari's private mode historically, and any browser with site data blocked.
 * A reader that cannot read is the same case as an empty store, and a writer
 * that cannot write must not take the application down over a panel width.
 */
const read = (): PersistedClient => {
  try {
    return decode(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return EMPTY;
  }
};

const write: Sink = (serialized) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Quota exceeded, or storage disabled. Losing the next reload's tab list is
    // not worth an exception in the middle of a drag.
  }
};

export { STORAGE_KEY, STORAGE_VERSION };
