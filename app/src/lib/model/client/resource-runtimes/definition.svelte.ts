import { SvelteMap } from "svelte/reactivity";
import type { Op } from "$revisions/types/op";
import type { GeneralResourceType } from "$revisions/types/resource";
import { attach } from "$model/client/resource-runtimes/methods/attach";
import { apply, buffer } from "$model/client/resource-runtimes/methods/apply";
import { flush } from "$model/client/resource-runtimes/methods/flush/flush";
import { redo, undo } from "$model/client/resource-runtimes/methods/history/history";
import { release } from "$model/client/resource-runtimes/methods/release";
import { releaseAll } from "$model/client/resource-runtimes/methods/release-all";
import { runtimeKey } from "$model/client/resource-runtimes/methods/shared/runtime-key";
import type {
  BodyFor,
  FlushThresholds,
  HistoryEntry,
  ResourceRuntime,
  ResourceRuntimesModel,
  RuntimeKey,
  SyncState
} from "$model/client/resource-runtimes/types";

/**
 * One open resource: the record, and the thin surface a view holds.
 *
 * **The fields are the state and the methods are one line each.** Every verb —
 * buffering, coalescing, submitting, inverting — is a free function in
 * `methods/` taking this instance, exactly as a workbench method takes
 * `WorkbenchState`. What is here is what cannot be a free function: the `$state`
 * declarations, which compile only in a `.svelte.ts`, and the composition of two
 * methods, which is the definition's job and no method's.
 *
 * A view never constructs one. `attach` returns it and the workbench is what
 * calls `attach`.
 */
export class Runtime<Body = unknown> implements ResourceRuntime<Body> {
  readonly type: GeneralResourceType;
  readonly id: string;
  readonly key: RuntimeKey;

  /** Undefined only before the first read lands. */
  body = $state<Body | undefined>(undefined);
  /** The revision every buffered op is authored against. */
  revision = $state(0);
  sync = $state<SyncState>("loading");

  /**
   * Unsent ops, in the order they were applied.
   *
   * `$state.raw` because it is replaced wholesale rather than mutated in place,
   * and a deep proxy over every op in a fast-typing buffer costs more than the
   * granularity would ever buy — nothing reads *into* an op here.
   */
  buffer = $state.raw<readonly Op[]>([]);

  /** One entry per gesture, which is what makes an undo undo a gesture. */
  undoStack = $state.raw<readonly HistoryEntry[]>([]);
  redoStack = $state.raw<readonly HistoryEntry[]>([]);

  /** Whether a submit is outstanding. Reactive, because `flushing` projects it. */
  inFlight = $state(false);

  /**
   * The debounce, the subscription, and the submit in flight. None is read by
   * anything reactive — `inFlight` above is what the projection watches, and
   * this is the promise a second caller joins rather than starting a second
   * submit.
   */
  timer: ReturnType<typeof setTimeout> | undefined;
  unsubscribe: (() => void) | undefined;
  pendingFlush: Promise<void> | undefined;

  readonly thresholds: FlushThresholds;

  constructor(type: GeneralResourceType, id: string, thresholds: FlushThresholds) {
    this.type = type;
    this.id = id;
    this.key = runtimeKey(type, id);
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

  /**
   * Two calls, because scheduling is composition rather than a step of
   * buffering: `apply` records the gesture and buffers it, and this decides
   * whether that made a submit due.
   */
  apply(ops: readonly Op[]): void {
    if (ops.length === 0) return;

    apply(this, ops);
    this.schedule();
  }

  async flush(): Promise<void> {
    await flush(this);
  }

  /**
   * The inverted ops are buffered *without* being recorded, which is the whole
   * difference between this and `apply`. Recording them would make an undo
   * undoable, and two undos in a row would flip between the same two states
   * forever instead of walking back through the history.
   */
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

  /**
   * Submit once either threshold is reached, whichever comes first.
   *
   * The timer is refreshed rather than left running, so the wait is measured
   * from the last op rather than the first. Typing continuously therefore
   * submits on the op count, and stopping submits on the clock — which is what
   * the two thresholds are for.
   */
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

  /**
   * A flush nobody is waiting on.
   *
   * The rejection is swallowed deliberately, and it is not swallowed silently:
   * `flush` has already recorded the failure in `sync` and kept the buffer, so
   * the strip reports it and the next flush retries it. Letting it escape here
   * would be an unhandled rejection from a debounce timer, which reaches the
   * console and no user.
   */
  flushInBackground(): void {
    void this.flush().catch(() => {});
  }

  clearTimer(): void {
    if (this.timer === undefined) return;

    clearTimeout(this.timer);
    this.timer = undefined;
  }
}

/**
 * The register's state, and the only thing a register method is handed.
 *
 * **Two maps rather than one.** `release` submits what is buffered and detaches
 * immediately, but the key has to keep reporting until that submit settles — a
 * runtime that could not send the user's last edits is work disappearing, and
 * dropping it silently is the one outcome with no recovery. So a released
 * runtime moves to `settling` and is deleted when its submit finishes.
 *
 * Exactly-once still falls out of the data rather than from a released-set:
 * `release` looks in `open`, and a second call finds nothing there.
 *
 * `SvelteMap` rather than `Map`, because `open` and `flushing` project the keys.
 * A plain map of reactive records tracks a field changing and *not* an entry
 * being added or deleted, so both projections would go stale exactly when a tab
 * opened or closed.
 */
export class ResourceRuntimesState {
  readonly open = new SvelteMap<RuntimeKey, Runtime>();
  readonly settling = new SvelteMap<RuntimeKey, Runtime>();

  readonly thresholds: FlushThresholds;

  constructor(thresholds: FlushThresholds) {
    this.thresholds = thresholds;
  }

  /**
   * Mints a runtime.
   *
   * A factory here rather than in `attach` for one reason: `$state` compiles
   * only in this file, so creating a reactive record is the one step that cannot
   * be a plain function. `attach` takes this state and imports only its type,
   * which is what keeps a method free of the class and this file free of a
   * cycle. `WorkbenchState.nextId` is the same move.
   */
  createRuntime(type: GeneralResourceType, id: string): Runtime {
    return new Runtime(type, id, this.thresholds);
  }
}

/**
 * `.svelte.ts` because the state above declares `$state`, and runes do not
 * compile in a plain `.ts`.
 *
 * Every body is one call except where two methods have to be composed, and
 * composing them is what a definition is for — a method that reached for a
 * sibling would be reaching across the ownership rule instead.
 */
export class ResourceRuntimes implements ResourceRuntimesModel {
  readonly #state: ResourceRuntimesState;

  constructor(thresholds: FlushThresholds) {
    this.#state = new ResourceRuntimesState(thresholds);
  }

  get open(): readonly RuntimeKey[] {
    return [...this.#state.open.keys()];
  }

  get flushing(): readonly RuntimeKey[] {
    return [...this.#state.open.values(), ...this.#state.settling.values()]
      .filter((runtime) => runtime.inFlight)
      .map((runtime) => runtime.key);
  }

  attach<T extends GeneralResourceType>(type: T, id: string): ResourceRuntime<BodyFor<T>> {
    return attach(this.#state, type, id) as ResourceRuntime<BodyFor<T>>;
  }

  release(type: GeneralResourceType, id: string): void {
    const detached = release(this.#state, type, id);
    if (detached) void this.#settle(detached);
  }

  releaseAll(): void {
    for (const detached of releaseAll(this.#state)) void this.#settle(detached);
  }

  /**
   * A detached runtime submits, and only then leaves the register.
   *
   * A submit that rejects or never settles leaves the key in `flushing`
   * reporting its own failure, deliberately — see `ResourceRuntimesState`.
   */
  async #settle(detached: Runtime): Promise<void> {
    try {
      await detached.flush();
    } catch {
      // Recorded in `sync` and the buffer is intact. Rethrowing here would be an
      // unhandled rejection from a tab close, which reaches nobody.
    }

    if (detached.sync !== "error" && detached.sync !== "needs-review") {
      this.#state.settling.delete(detached.key);
    }
  }
}
