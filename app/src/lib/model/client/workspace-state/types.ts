import type { read } from "$capabilities/store/index.remote";
import type { username } from "$capabilities/development/index.remote";
import type { DocumentRuntime } from "$model/client/document-runtimes";
import type { SlideDeckRuntime } from "$model/client/slide-deck-runtimes";
import type { SpreadsheetRuntime } from "$model/client/spreadsheet-runtimes";
import type { ContextView } from "$representation/data/types/workspace/views";
import type { Category, ContentView } from "$representation/data/types/workspace/categories";
import type { TableName } from "$representation/store/tables";
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

export type WorkspaceSync =
  | "loading"
  | "saved"
  | "saving"
  | "rebasing"
  | "needs-review"
  | "error";

/** Primitive pieces keep one durable command key unambiguous and serializable. */
export type SingleFlightKeyPart = string | number | boolean | null;

export type StoreQuery = ReturnType<typeof read>;
export type StoreReader = typeof read;
export type UsernameQuery = ReturnType<typeof username>;
export type UsernameReader = typeof username;

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

  readonly zoom: number | null;
  setZoom(zoom: number): void;

  showing(category: Category, content?: ContentView): boolean;

  /** Share one pending durable command across every surface in this workspace. */
  singleFlight<Result>(
    key: readonly SingleFlightKeyPart[],
    run: () => PromiseLike<Result>
  ): Promise<Result>;

  documentRuntime(resourceId: string): DocumentRuntime;
  slideDeckRuntime(resourceId: string): SlideDeckRuntime;
  spreadsheetRuntime(resourceId: string): SpreadsheetRuntime;

  /**
   * What somebody typed and has not sent, kept for as long as this workspace.
   *
   * A composing surface is remounted when its tab is left, so the text has to be
   * held by something that is not the surface. An empty string forgets the key.
   */
  draft(key: string): string;
  keepDraft(key: string, text: string): void;

  /** A table read whose remote resource is owned by this client workspace. */
  readStore(table: TableName): StoreQuery;

  /** The session-name read, under the same workspace lifetime. */
  readUsername(): UsernameQuery;

  undo(): void;
  redo(): void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;

  readonly revision: number;
  readonly sync: WorkspaceSync;
  readonly pending: number;

  restore(): Promise<void>;
  flush(): Promise<void>;
  release(): void;
}
