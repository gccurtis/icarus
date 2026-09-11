import { SvelteMap } from "svelte/reactivity";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type { PresentationOp } from "$representation/data/types/presentations/op";
import { apply, buffer } from "$model/client/presentation-runtimes/methods/apply";
import { attach } from "$model/client/presentation-runtimes/methods/attach";
import { flush } from "$model/client/presentation-runtimes/methods/flush/flush";
import { sync } from "$model/client/presentation-runtimes/methods/sync";
import { redo, undo } from "$model/client/presentation-runtimes/methods/history/history";
import { of } from "$model/client/presentation-runtimes/methods/of";
import { release } from "$model/client/presentation-runtimes/methods/release";
import { releaseAll } from "$model/client/presentation-runtimes/methods/release-all";
import type {
  FlushThresholds,
  StageSettings,
  HistoryEntry,
  PresentationRuntime,
  PresentationRuntimesModel,
  SyncState
} from "$model/client/presentation-runtimes/types";

export class Runtime implements PresentationRuntime {
  readonly id: string;

  body = $state<PresentationBody | undefined>(undefined);
  revision = $state(0);
  sync = $state<SyncState>("loading");

  buffer = $state.raw<readonly PresentationOp[]>([]);
  undoStack = $state.raw<readonly HistoryEntry[]>([]);
  redoStack = $state.raw<readonly HistoryEntry[]>([]);

  inFlight = $state(false);

  timer: ReturnType<typeof setTimeout> | undefined;
  unsubscribe: (() => void) | undefined;
  pendingFlush: Promise<void> | undefined;

  readonly thresholds: FlushThresholds;
  readonly stage: StageSettings;

  constructor(id: string, thresholds: FlushThresholds, stage: StageSettings) {
    this.id = id;
    this.thresholds = thresholds;
    this.stage = stage;
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

  apply(ops: readonly PresentationOp[]): void {
    if (ops.length === 0) return;

    apply(this, JSON.parse(JSON.stringify(ops)) as PresentationOp[]);
    this.schedule();
  }

  async flush(): Promise<void> {
    await flush(this);
  }

  /**
   * What waking up means, however a runtime was woken: send what it holds, or
   * read what it does not. The two are one decision so they can never race.
   */
  async tick(): Promise<void> {
    if (this.buffer.length > 0) {
      await flush(this);
      return;
    }

    await sync(this);
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
    void this.tick().catch(() => {});
  }

  clearTimer(): void {
    if (this.timer === undefined) return;

    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

export class PresentationRuntimesState {
  readonly open = new SvelteMap<string, Runtime>();
  readonly settling = new SvelteMap<string, Runtime>();

  readonly thresholds: FlushThresholds;
  readonly stage: StageSettings;

  constructor(thresholds: FlushThresholds, stage: StageSettings) {
    this.thresholds = thresholds;
    this.stage = stage;
  }

  createRuntime(id: string): Runtime {
    return new Runtime(id, this.thresholds, this.stage);
  }
}

export class PresentationRuntimes implements PresentationRuntimesModel {
  readonly #state: PresentationRuntimesState;

  constructor(thresholds: FlushThresholds, stage: StageSettings) {
    this.#state = new PresentationRuntimesState(thresholds, stage);
  }

  get open(): readonly string[] {
    return [...this.#state.open.keys()];
  }

  get flushing(): readonly string[] {
    return [...this.#state.open.values(), ...this.#state.settling.values()]
      .filter((runtime) => runtime.inFlight)
      .map((runtime) => runtime.id);
  }

  of(id: string): PresentationRuntime | undefined {
    return of(this.#state, id);
  }

  attach(id: string): PresentationRuntime {
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
