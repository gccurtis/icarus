import type { ContextView } from "$representation/data/types/workspace/views";
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
  selectContext(id: TabId, contextId: ContextView | null): void;
  inspect(id: TabId, inspected: Inspected, selection: Selection | null): void;
  clear(id: TabId): void;
  resize(id: TabId, patch: Partial<Frame>): void;
}
