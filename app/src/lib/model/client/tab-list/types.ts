import type { TabId, TabRecord, Target } from "$representation/data/types/views/tab";

export interface TabListModel {
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly active: TabRecord;

  mint(target: Target): TabRecord;
  add(record: TabRecord, at?: number): number;
  remove(id: TabId): number;
  activate(id: TabId): void;
  at(index: number): TabRecord | undefined;
  find(id: TabId): TabRecord | undefined;
  indexOf(id: TabId): number;
}
