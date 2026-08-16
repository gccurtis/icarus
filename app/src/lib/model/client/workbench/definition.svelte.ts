import type { ClientStorage } from "$model/client/storage";
import { activate } from "$model/client/workbench/methods/activate";
import { activeContext } from "$model/client/workbench/methods/active-context";
import { availableContexts } from "$model/client/workbench/methods/available-contexts";
import { close } from "$model/client/workbench/methods/close";
import { currentInspection } from "$model/client/workbench/methods/current-inspection";
import { inspect } from "$model/client/workbench/methods/inspect";
import { open } from "$model/client/workbench/methods/open/open";
import { restore } from "$model/client/workbench/methods/open/restore/restore";
import { panels } from "$model/client/workbench/methods/panels";
import { reorder } from "$model/client/workbench/methods/reorder";
import { resize } from "$model/client/workbench/methods/resize";
import { selectContext } from "$model/client/workbench/methods/select-context";
import { activeTab } from "$model/client/workbench/methods/shared/active-tab";
import { update } from "$model/client/workbench/methods/update";
import type {
  ContextId,
  Inspection,
  InspectionNode,
  Panels,
  ResourceRef,
  Tab,
  TabId,
  TabOptions,
  WorkbenchModel
} from "$model/client/workbench/types";
import { PROJECT_OVERVIEW } from "$model/client/workbench/types";

/**
 * The instance's state, and the only thing a method is handed.
 *
 * A class rather than a bag of fields on `Workbench` because `activeId` is a
 * primitive: a method cannot reassign it through a value it was passed unless
 * something owns the binding. This owns it.
 *
 * The id counter is an **instance** field, not module scope. It was module scope
 * before the model directory existed, and it is not user data, so it reads as
 * harmless — which is exactly why it is the thing most likely to be carried
 * across a rename untouched. One counter per process would mint ids for every
 * client instance at once, so two users' tabs interleave and an id stops being
 * reproducible from a fresh boot.
 */
export class WorkbenchState {
  tabs = $state<Tab[]>([]);
  activeId = $state<TabId>("");
  #counter = 0;

  constructor(readonly storage: ClientStorage) {}

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
  #state: WorkbenchState;

  constructor(storage: ClientStorage) {
    this.#state = new WorkbenchState(storage);

    // The permanent tab is constructed here rather than restored, which is what
    // makes "activeId is never empty" an invariant rather than a hope.
    const overview: Tab = {
      id: this.#state.nextId(),
      resource: PROJECT_OVERVIEW,
      permanent: true,
      options: {}
    };
    this.#state.tabs = [overview];
    this.#state.activeId = overview.id;

    restore(this.#state);
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

  open(resource: ResourceRef): Tab {
    return open(this.#state, resource);
  }

  close(id: TabId): void {
    close(this.#state, id);
  }

  activate(id: TabId): void {
    activate(this.#state, id);
  }

  reorder(id: TabId, index: number): void {
    reorder(this.#state, id, index);
  }

  update(id: TabId, patch: Partial<TabOptions>): void {
    update(this.#state, id, patch);
  }

  get availableContexts(): readonly ContextId[] {
    return availableContexts(this.#state);
  }

  get activeContext(): ContextId {
    return activeContext(this.#state);
  }

  selectContext(id: ContextId): void {
    selectContext(this.#state, id);
  }

  get currentInspection(): InspectionNode | undefined {
    return currentInspection(this.#state);
  }

  inspect(inspection?: Inspection): void {
    inspect(this.#state, inspection);
  }

  get panels(): Panels {
    return panels(this.#state);
  }

  resize(patch: Partial<Panels>): void {
    resize(this.#state, patch);
  }
}
