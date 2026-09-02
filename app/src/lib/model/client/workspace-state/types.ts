import type { ContextView } from "$representation/data/types/workspace/views";
import type { Category, ContentView } from "$representation/data/types/workspace/categories";
import type {
  Frame,
  Inspected,
  Selection,
  TabId,
  Target
} from "$representation/data/types/workspace/tab";

export type Tab = {
  readonly id: TabId;
  readonly category: Category;
  content: ContentView;
  readonly resourceId?: string;
  contextId: ContextView | undefined;
  focus?: string;
  inspected: Inspected;
  selection?: Selection;
  frame: Frame;
};

export type WorkspaceSync = "loading" | "saved" | "saving" | "error";

export interface WorkspaceStateModel {
  readonly project: string;

  readonly tabs: readonly Tab[];
  readonly activeId: TabId;

  readonly active: Tab;
  readonly frame: Frame;
  readonly context: ContextView | undefined;
  readonly inspected: Inspected;
  readonly selection: Selection | undefined;

  open(target: Target): Tab;
  activate(id: TabId): void;
  close(id: TabId): void;
  reopenClosed(): Tab | undefined;

  showContent(content: ContentView, focus?: string): void;
  selectContext(id: ContextView): void;

  inspect(key: Inspected, selection?: Selection): void;
  clear(): void;

  resize(patch: Partial<Frame>): void;

  showing(category: Category, content?: ContentView): boolean;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  readonly revision: number;
  readonly sync: WorkspaceSync;
  readonly pending: number;

  restore(): Promise<void>;
  flush(): Promise<void>;
}
