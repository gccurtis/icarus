import type { TabId, TabRecord, Target } from "$representation/data/types/views/tab";
import { activate } from "$model/client/tab-list/methods/activate";
import { add } from "$model/client/tab-list/methods/add";
import { mint } from "$model/client/tab-list/methods/mint";
import { remove } from "$model/client/tab-list/methods/remove";
import type { TabListModel } from "$model/client/tab-list/types";

export class TabListData {
  records = $state<TabRecord[]>([]);
  activeId = $state<TabId>("");

  counter = 0;

  get active(): TabRecord {
    return this.records.find((record) => record.id === this.activeId) ?? this.records[0];
  }
}

export class TabList implements TabListModel {
  readonly #state = new TabListData();

  get tabs(): readonly TabRecord[] {
    return this.#state.records;
  }

  get activeId(): TabId {
    return this.#state.activeId;
  }

  get active(): TabRecord {
    return this.#state.active;
  }

  mint(target: Target): TabRecord {
    return mint(this.#state, target);
  }

  add(record: TabRecord, at?: number): number {
    return add(this.#state, record, at);
  }

  remove(id: TabId): number {
    return remove(this.#state, id);
  }

  activate(id: TabId): void {
    activate(this.#state, id);
  }

  at(index: number): TabRecord | undefined {
    return this.#state.records[index];
  }

  find(id: TabId): TabRecord | undefined {
    return this.#state.records.find((record) => record.id === id);
  }

  indexOf(id: TabId): number {
    return this.#state.records.findIndex((record) => record.id === id);
  }
}
