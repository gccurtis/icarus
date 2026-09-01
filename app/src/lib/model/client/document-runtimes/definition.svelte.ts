import { SvelteMap } from "svelte/reactivity";
import type { DocumentBody } from "$representation/data/types/resources/document-body";
import type { DocumentOp } from "$representation/data/types/revisions/document-op";
import { apply, buffer } from "$model/client/document-runtimes/methods/apply";
import { attach } from "$model/client/document-runtimes/methods/attach";
import { flush } from "$model/client/document-runtimes/methods/flush/flush";
import { redo, undo } from "$model/client/document-runtimes/methods/history/history";
import { release } from "$model/client/document-runtimes/methods/release";
import { releaseAll } from "$model/client/document-runtimes/methods/release-all";
import type {
  DocumentRuntime,
  DocumentRuntimesModel,
  FlushThresholds,
  HistoryEntry,
  SyncState
} from "$model/client/document-runtimes/types";

export class Runtime implements DocumentRuntime {
  readonly id: string;

  body = $state<DocumentBody | undefined>(undefined);
  revision = $state(0);
  sync = $state<SyncState>("loading");

  buffer = $state.raw<readonly DocumentOp[]>([]);
  undoStack = $state.raw<readonly HistoryEntry[]>([]);
  redoStack = $state.raw<readonly HistoryEntry[]>([]);

  inFlight = $state(false);

  timer: ReturnType<typeof setTimeout> | undefined;
  unsubscribe: (() => void) | undefined;
  pendingFlush: Promise<void> | undefined;

  readonly thresholds: FlushThresholds;

  constructor(id: string, thresholds: FlushThresholds) {
    this.id = id;
    this.thresholds = thresholds;
  }

  get pending(): number {
    return this.buffer.length;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  apply(ops: readonly DocumentOp[]): void {
    if (ops.length === 0) return;

    apply(this, ops);
    this.schedule();
  }

  async flush(): Promise<void> {
    await flush(this);
  }

  undo(): void {
    const ops = undo(this);
    if (ops.length === 0) return;

    buffer(this, ops);
    this.schedule();
  }

  redo(): void {
    const ops = redo(this);
    if (ops.length === 0) return;

    buffer(this, ops);
    this.schedule();
  }

  schedule(): void {
    if (this.buffer.length >= this.thresholds.afterOps) {
      this.flushInBackground();
      return;
    }

    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.flushInBackground();
    }, this.thresholds.afterMs);
  }

  flushInBackground(): void {
    void this.flush().catch(() => {});
  }

  clearTimer(): void {
    if (this.timer === undefined) return;

    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export class DocumentRuntimesState {
  readonly open = new SvelteMap<string, Runtime>();
  readonly settling = new SvelteMap<string, Runtime>();

  readonly thresholds: FlushThresholds;

  constructor(thresholds: FlushThresholds) {
    this.thresholds = thresholds;
  }

  createRuntime(id: string): Runtime {
    return new Runtime(id, this.thresholds);
  }
}

export class DocumentRuntimes implements DocumentRuntimesModel {
  readonly #state: DocumentRuntimesState;

  constructor(thresholds: FlushThresholds) {
    this.#state = new DocumentRuntimesState(thresholds);
  }

  get open(): readonly string[] {
    return [...this.#state.open.keys()];
  }

  get flushing(): readonly string[] {
    return [...this.#state.open.values(), ...this.#state.settling.values()]
      .filter((runtime) => runtime.inFlight)
      .map((runtime) => runtime.id);
  }

  attach(id: string): DocumentRuntime {
    return attach(this.#state, id);
  }

  release(id: string): void {
    const detached = release(this.#state, id);
    if (detached) void this.#settle(detached);
  }

  releaseAll(): void {
    for (const detached of releaseAll(this.#state)) void this.#settle(detached);
  }

  async #settle(detached: Runtime): Promise<void> {
    try {
      await detached.flush();
    } catch {
      /* empty */
    }

    if (detached.sync !== "error" && detached.sync !== "needs-review") {
      this.#state.settling.delete(detached.id);
    }
  }
}
