import type { ContextId } from "$representation/data/types/views/panels";
import type { Screen, Subscreen } from "$representation/data/types/views/screens";
import type {
  Frame,
  Inspected,
  Selection,
  TabId,
  Target
} from "$representation/data/types/views/tab";

export type Tab = {
  readonly id: TabId;
  readonly screen: Screen;
  subscreen: Subscreen;
  readonly resourceId?: string;
  contextId: ContextId | undefined;
  focus?: string;
  inspected: Inspected;
  selection?: Selection;
  frame: Frame;
};

export type ViewSync = "loading" | "saved" | "saving" | "error";

export interface ViewStateModel {
  readonly project: string;

  readonly tabs: readonly Tab[];
  readonly activeId: TabId;

  readonly active: Tab;
  readonly frame: Frame;
  readonly context: ContextId | undefined;
  readonly inspected: Inspected;
  readonly selection: Selection | undefined;

  open(target: Target): Tab;
  activate(id: TabId): void;
  close(id: TabId): void;
  reopenClosed(): Tab | undefined;

  showSubscreen(subscreen: Subscreen, focus?: string): void;
  selectContext(id: ContextId): void;

  inspect(key: Inspected, selection?: Selection): void;
  clear(): void;

  resize(patch: Partial<Frame>): void;

  showing(screen: Screen, subscreen?: Subscreen): boolean;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  readonly revision: number;
  readonly sync: ViewSync;
  readonly pending: number;

  restore(): Promise<void>;
  flush(): Promise<void>;
}
