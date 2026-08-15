import { encode } from "$model/client/storage/methods/serialize";
import type {
  ClientStorage,
  PersistedClient,
  PersistedWorkbench,
  Sink
} from "$model/client/storage/types";

/**
 * A plain `definition.ts`: this owns a document and a sink, and neither is
 * reactive. Making it `.svelte.ts` to match its neighbour would claim a cost
 * this object does not pay — nothing reads storage during a render, because
 * everything read here was already handed to the workbench at construction.
 */
export class Storage implements ClientStorage {
  #document: PersistedClient;
  #pending = false;

  constructor(
    initial: PersistedClient,
    private readonly sink: Sink
  ) {
    this.#document = initial;
  }

  get workbench(): PersistedWorkbench | undefined {
    return this.#document.workbench;
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
