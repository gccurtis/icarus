import type { ClientStorage, PersistedTab } from "$runtime/client/storage";
import type {
  ResourceRef,
  Tab,
  TabId,
  TabOptions,
  WorkbenchRuntime
} from "$runtime/client/workbench/types";
import { PROJECT_OVERVIEW, isResourceKind } from "$runtime/client/workbench/types";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/**
 * `.svelte.ts` because this holds `$state`. Fields are private and the public
 * surface is getters: reassigning an exported `let` does not propagate across a
 * module boundary, but reading through a getter does.
 */
export class Workbench implements WorkbenchRuntime {
  #tabs = $state<Tab[]>([]);
  #activeId = $state<TabId>("");

  /**
   * The id counter is an **instance** field, not module scope.
   *
   * It was module scope before this move, and it is not user data, so it reads
   * as harmless — which is exactly why it is the thing most likely to be carried
   * across a rename untouched. One counter per process would mint ids for every
   * user at once, so two users' tabs interleave and an id stops being
   * reproducible from a fresh boot.
   */
  #counter = 0;

  constructor(private readonly storage: ClientStorage) {
    const overview: Tab = {
      id: this.#nextId(),
      resource: PROJECT_OVERVIEW,
      permanent: true,
      options: {}
    };
    this.#tabs = [overview];
    this.#activeId = overview.id;

    this.#restore();
  }

  get tabs(): readonly Tab[] {
    return this.#tabs;
  }

  get activeId(): TabId {
    return this.#activeId;
  }

  get active(): Tab {
    const tab = this.#find(this.#activeId);
    if (!tab) {
      // Unreachable unless the never-empty invariant has been broken, which
      // would mean a permanent tab was removed.
      throw new Error(`Active tab ${this.#activeId} is not in the tab list.`);
    }
    return tab;
  }

  open(resource: ResourceRef): Tab {
    // Match on kind *and* id: ids are only unique within a kind.
    const existing = this.#tabs.find(
      (tab) => tab.resource.kind === resource.kind && tab.resource.id === resource.id
    );
    if (existing) {
      this.#activeId = existing.id;
      this.#persist();
      return existing;
    }

    const tab: Tab = { id: this.#nextId(), resource, permanent: false, options: {} };
    this.#tabs.push(tab);
    this.#activeId = tab.id;
    this.#persist();
    return tab;
  }

  close(id: TabId): void {
    const index = this.#tabs.findIndex((tab) => tab.id === id);
    if (index === -1) throw new Error(`Cannot close unknown tab ${id}.`);
    if (this.#tabs[index].permanent) {
      throw new Error(`Tab ${id} is permanent and cannot be closed.`);
    }

    const wasActive = this.#activeId === id;
    this.#tabs.splice(index, 1);

    if (wasActive) {
      // Right, then left. After the splice the element now *at* `index` is the
      // one that was to the right. A permanent tab always survives, so this
      // cannot fall through to nothing.
      const next = this.#tabs[index] ?? this.#tabs[index - 1];
      this.#activeId = next.id;
    }

    this.#persist();
  }

  activate(id: TabId): void {
    if (!this.#find(id)) throw new Error(`Cannot activate unknown tab ${id}.`);
    this.#activeId = id;
    this.#persist();
  }

  reorder(id: TabId, index: number): void {
    const from = this.#tabs.findIndex((tab) => tab.id === id);
    if (from === -1) throw new Error(`Cannot reorder unknown tab ${id}.`);
    if (this.#tabs[from].permanent) {
      throw new Error(`Tab ${id} is permanent and cannot be reordered.`);
    }

    // `index` is a position among transient tabs, so it is offset past the
    // permanent prefix. Clamping rather than throwing: a drag that overshoots
    // the ends is a normal gesture, not a caller error.
    const offset = this.#tabs.filter((tab) => tab.permanent).length;
    const to = offset + clamp(index, 0, this.#tabs.length - offset - 1);

    const [tab] = this.#tabs.splice(from, 1);
    this.#tabs.splice(to, 0, tab);
    this.#persist();
  }

  update(id: TabId, patch: Partial<TabOptions>): void {
    const tab = this.#find(id);
    if (!tab) throw new Error(`Cannot update unknown tab ${id}.`);
    tab.options = { ...tab.options, ...patch };

    // `inspection` and `scrollTop` are not persisted, so only an activity change
    // is worth a write. Persisting on every caret move would be a write per
    // keystroke-adjacent action.
    if (patch.activityId !== undefined) this.#persist();
  }

  /**
   * Replays stored tabs through `open()`.
   *
   * Restoring is deliberately the same code path as opening: `open` already
   * dedupes on kind and id, so a stored duplicate of the permanent tab collapses
   * into it rather than appearing twice, and ids are minted fresh rather than
   * restored — a stored id would be meaningless on this boot and could collide
   * with one this counter is about to mint.
   */
  #restore(): void {
    const stored = this.storage.workbench;
    if (!stored) return;

    for (const [kind, id, activityId] of stored.tabs) {
      // A kind from an older build may no longer exist. `ACTIVITIES` is keyed by
      // kind, so an unknown one resolves to undefined and throws during paint.
      if (!isResourceKind(kind)) continue;

      const tab = this.open({ kind, id });
      if (activityId !== undefined) tab.options = { ...tab.options, activityId };
    }

    const active = stored.active;
    if (!active) return;

    // A ref rather than an index, so a dropped tab cannot silently activate its
    // neighbour. An unmatched ref leaves whatever `open` last activated.
    const match = this.#tabs.find(
      (tab) => tab.resource.kind === active[0] && tab.resource.id === active[1]
    );
    if (match) this.#activeId = match.id;
  }

  #persist(): void {
    this.storage.saveWorkbench({
      // The permanent tab is reconstructed by the constructor, so storing it
      // would mean relying on `open`'s dedupe to remove it again.
      tabs: this.#tabs
        .filter((tab) => !tab.permanent)
        .map((tab): PersistedTab =>
          tab.options.activityId === undefined
            ? [tab.resource.kind, tab.resource.id]
            : [tab.resource.kind, tab.resource.id, tab.options.activityId]
        ),
      active: [this.active.resource.kind, this.active.resource.id]
    });
  }

  #nextId(): TabId {
    return `tab-${++this.#counter}`;
  }

  #find(id: TabId): Tab | undefined {
    return this.#tabs.find((tab) => tab.id === id);
  }
}
