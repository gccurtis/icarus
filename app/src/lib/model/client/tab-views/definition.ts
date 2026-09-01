import { SvelteMap } from "svelte/reactivity";

import type { ContextId } from "$representation/data/types/views/panels";
import type {
  Frame,
  Inspected,
  Landing,
  Selection,
  TabId,
  TabView
} from "$representation/data/types/views/tab";
import { of } from "$model/client/tab-views/methods/of";
import { patch } from "$model/client/tab-views/methods/patch";
import type { TabViewsModel } from "$model/client/tab-views/types";

export class TabViewsData {
  readonly views = new SvelteMap<TabId, TabView>();
}

export class TabViews implements TabViewsModel {
  readonly #state = new TabViewsData();

  get ids(): readonly TabId[] {
    return [...this.#state.views.keys()];
  }

  of(id: TabId): TabView {
    return of(this.#state, id);
  }

  set(id: TabId, view: TabView): void {
    this.#state.views.set(id, view);
  }

  forget(id: TabId): void {
    this.#state.views.delete(id);
  }

  land(id: TabId, landing: Landing): void {
    patch(this.#state, id, landing);
  }

  focusOn(id: TabId, focus: string | null): void {
    patch(this.#state, id, { focus });
  }

  selectContext(id: TabId, contextId: ContextId | null): void {
    patch(this.#state, id, { contextId });
  }

  inspect(id: TabId, inspected: Inspected, selection: Selection | null): void {
    patch(this.#state, id, { inspected, selection });
  }

  clear(id: TabId): void {
    patch(this.#state, id, { inspected: "empty", selection: null });
  }

  resize(id: TabId, change: Partial<Frame>): void {
    patch(this.#state, id, { frame: { ...of(this.#state, id).frame, ...change } });
  }
}
