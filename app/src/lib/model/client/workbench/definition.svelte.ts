import type { ResourceRuntime, ResourceRuntimesModel } from "$model/client/resource-runtimes";
import { activate } from "$model/client/workbench/methods/activate";
import { close } from "$model/client/workbench/methods/close";
import { closeAll } from "$model/client/workbench/methods/close-all";
import { frame } from "$model/client/workbench/methods/frame";
import { inspect } from "$model/client/workbench/methods/inspect";
import { inspectedNode } from "$model/client/workbench/methods/inspected-node";
import { open } from "$model/client/workbench/methods/open/open";
import { resolveLauncher } from "$model/client/workbench/methods/open/resolve-launcher";
import { reopenClosed } from "$model/client/workbench/methods/reopen-closed";
import { reorder } from "$model/client/workbench/methods/reorder";
import { resize } from "$model/client/workbench/methods/resize";
import { runtimeFor } from "$model/client/workbench/methods/runtime-for";
import { selectContext } from "$model/client/workbench/methods/select-context";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import { adoptTarget } from "$model/client/workbench/methods/shared/adopt-target";
import { update } from "$model/client/workbench/methods/update";
import type {
  Frame,
  InspectionKey,
  ScreenKind,
  Tab,
  TabId,
  TabTarget,
  ViewStatePatch,
  WorkbenchModel
} from "$model/client/workbench/types";
import { SINGLETON_TARGETS } from "$model/client/workbench/types";

/**
 * The instance's state, and the only thing a method is handed.
 *
 * A class rather than a bag of fields on `Workbench` because `activeId` is a
 * primitive: a method cannot reassign it through a value it was passed unless
 * something owns the binding. This owns it.
 *
 * The id counter is an **instance** field, not module scope. It is not user data,
 * so it reads as harmless — which is exactly why it is the thing most likely to
 * be carried across a rename untouched. One counter per process would mint ids
 * for every client instance at once, so two users' tabs interleave and an id
 * stops being reproducible from a fresh boot.
 */
export class WorkbenchState {
  tabs = $state<Tab[]>([]);
  activeId = $state<TabId>("");

  /** The reopen queue, most recently closed first. Not persisted, ever. */
  closed = $state.raw<readonly Tab[]>([]);

  #counter = 0;

  constructor(readonly runtimes: ResourceRuntimesModel) {}

  nextId(): TabId {
    return `tab-${++this.#counter}`;
  }
}

/**
 * `.svelte.ts` because the state it holds declares `$state`, and runes do not
 * compile in a plain `.ts`. Fields are private and the public surface is
 * getters: reassigning an exported `let` does not propagate across a module
 * boundary, but reading through a getter does.
 *
 * Every body here is one call. The surface is what this file is for — the flow
 * behind it lives in `methods/`, where it can be read one method at a time.
 */
export class Workbench implements WorkbenchModel {
  readonly #state: WorkbenchState;

  constructor(runtimes: ResourceRuntimesModel) {
    this.#state = new WorkbenchState(runtimes);

    // The singletons are constructed here rather than restored, which is what
    // makes "activeId is never empty" an invariant rather than a hope. They are
    // minted through `adoptTarget` like every other tab, so nothing about them
    // is a special case beyond being built first.
    this.#state.tabs = SINGLETON_TARGETS.map((target) => adoptTarget(this.#state, target));
    this.#state.activeId = this.#state.tabs[0].id;
  }

  get tabs(): readonly Tab[] {
    return this.#state.tabs;
  }

  get activeId(): TabId {
    return this.#state.activeId;
  }

  get active(): Tab {
    return activeTab(this.#state);
  }

  get closed(): readonly Tab[] {
    return this.#state.closed;
  }

  open(target: TabTarget): Tab {
    return open(this.#state, target);
  }

  resolveLauncher(id: TabId, target: TabTarget): Tab {
    return resolveLauncher(this.#state, id, target);
  }

  close(id: TabId): void {
    close(this.#state, id);
  }

  closeAll(): void {
    closeAll(this.#state);
  }

  activate(id: TabId): void {
    activate(this.#state, id);
  }

  reorder(id: TabId, index: number): void {
    reorder(this.#state, id, index);
  }

  reopenClosed(): Tab | undefined {
    return reopenClosed(this.#state);
  }

  update<K extends ScreenKind>(id: TabId, kind: K, patch: ViewStatePatch<K>): void {
    update(this.#state, id, kind, patch);
  }

  selectContext(id: string): void {
    selectContext(this.#state, id);
  }

  get inspectedNode(): InspectionKey | undefined {
    return inspectedNode(this.#state);
  }

  inspect(key?: InspectionKey): void {
    inspect(this.#state, key);
  }

  get frame(): Frame {
    return frame(this.#state);
  }

  resize(patch: Partial<Omit<Frame, "contextId">>): void {
    resize(this.#state, patch);
  }

  runtimeFor(id: TabId): ResourceRuntime<unknown> | undefined {
    return runtimeFor(this.#state, id);
  }
}
