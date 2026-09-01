import type { ContextId } from "$representation/data/types/workspace/panels";
import type {
  Frame,
  Inspected,
  Landing,
  Selection,
  TabId,
  TabView
} from "$representation/data/types/workspace/tab";

export interface TabViewsModel {
  readonly ids: readonly TabId[];

  of(id: TabId): TabView;
  set(id: TabId, view: TabView): void;
  forget(id: TabId): void;

  land(id: TabId, landing: Landing): void;
  focusOn(id: TabId, focus: string | null): void;
  selectContext(id: TabId, contextId: ContextId | null): void;
  inspect(id: TabId, inspected: Inspected, selection: Selection | null): void;
  clear(id: TabId): void;
  resize(id: TabId, patch: Partial<Frame>): void;
}
