import type {
  ContextId,
  Screen,
  Subscreen
} from "$model/client/view-state/methods/shared/keys";
import { activate } from "$model/client/view-state/methods/activate";
import { clear } from "$model/client/view-state/methods/clear";
import { close } from "$model/client/view-state/methods/close";
import { inspect } from "$model/client/view-state/methods/inspect";
import { open } from "$model/client/view-state/methods/open";
import { reopenClosed } from "$model/client/view-state/methods/reopen-closed";
import { resize } from "$model/client/view-state/methods/resize";
import { selectContext } from "$model/client/view-state/methods/select-context";
import { mintTab } from "$model/client/view-state/methods/shared/mint-tab";
import { showSubscreen } from "$model/client/view-state/methods/show-subscreen";
import { showing } from "$model/client/view-state/methods/showing";
import { defaultContext, offersContext } from "$model/client/view-state/methods/shared/rails";
import {
  SINGLETONS,
  type Frame,
  type Inspected,
  type Selection,
  type Tab,
  type TabId,
  type Target,
  type ViewStateModel
} from "$model/client/view-state/types";

/**
 * The instance's state, and the only thing a method is handed.
 *
 * A class rather than a bag of fields on `ViewState`, because a method cannot
 * reassign a binding through a value it was passed unless something owns the
 * binding. This owns them.
 *
 * **The singletons are built here rather than restored.** That is what makes
 * "`activeId` names a real tab, always" an invariant rather than a hope: the
 * seven permanent screens exist from the first frame, none of them can be
 * closed, so there is always something to fall back to.
 */
export class ViewStateData {
  /** Singletons first, then what the person opened, in their order. */
  tabs = $state<Tab[]>([]);
  activeId = $state<TabId>("");
  closed = $state<Tab[]>([]);

  #counter = 0;

  constructor(readonly project: string) {
    for (const screen of SINGLETONS) this.tabs.push(mintTab(this.nextId(), { screen }));
    this.activeId = this.tabs[0].id;
  }

  /** Ids are per instance and never persisted, so a counter is enough. */
  nextId(): TabId {
    this.#counter += 1;
    return `t${this.#counter}`;
  }

  /**
   * The tab everything else is about.
   *
   * The fallback is unreachable by construction and is here so the type is not
   * `Tab | undefined` for every caller — which would be eleven `?.` operators
   * guarding a case that cannot happen.
   */
  get active(): Tab {
    return this.tabs.find((tab) => tab.id === this.activeId) ?? this.tabs[0];
  }
}

/**
 * `.svelte.ts` because the state it holds declares `$state`, and runes do not
 * compile in a plain `.ts`. The state is private and the public surface is
 * getters: reassigning a field does not propagate across a module boundary, but
 * reading through a getter does.
 *
 * Every body here is one call. The surface is what this file is for — the flow
 * behind it lives in `methods/`, where it can be read one method at a time.
 */
export class ViewState implements ViewStateModel {
  readonly #state: ViewStateData;

  constructor(project: string) {
    this.#state = new ViewStateData(project);
  }

  get project(): string {
    return this.#state.project;
  }

  get tabs(): readonly Tab[] {
    return this.#state.tabs;
  }

  get activeId(): TabId {
    return this.#state.activeId;
  }

  get closed(): readonly Tab[] {
    return this.#state.closed;
  }

  get active(): Tab {
    return this.#state.active;
  }

  get frame(): Frame {
    return this.#state.active.frame;
  }

  /**
   * The rail position, or this subscreen's default if it has drifted.
   *
   * Derived rather than stored, so a subscreen change cannot leave the panel
   * pointing at a view its rail no longer offers even if nothing reset it.
   */
  get context(): ContextId | undefined {
    const tab = this.#state.active;
    return tab.contextId !== undefined && offersContext(tab.screen, tab.subscreen, tab.contextId)
      ? tab.contextId
      : defaultContext(tab.screen, tab.subscreen);
  }

  get inspected(): Inspected {
    return this.#state.active.inspected;
  }

  get selection(): Selection | undefined {
    return this.#state.active.selection;
  }

  open(target: Target): Tab {
    return open(this.#state, target);
  }

  activate(id: TabId): void {
    activate(this.#state, id);
  }

  close(id: TabId): void {
    close(this.#state, id);
  }

  reopenClosed(): Tab | undefined {
    return reopenClosed(this.#state);
  }

  showSubscreen(subscreen: Subscreen): void {
    showSubscreen(this.#state, subscreen);
  }

  selectContext(id: ContextId): void {
    selectContext(this.#state, id);
  }

  inspect(key: Inspected, selection?: Selection): void {
    inspect(this.#state, key, selection);
  }

  clear(): void {
    clear(this.#state);
  }

  resize(patch: Partial<Frame>): void {
    resize(this.#state, patch);
  }

  showing(screen: Screen, subscreen?: Subscreen): boolean {
    return showing(this.#state, screen, subscreen);
  }
}
