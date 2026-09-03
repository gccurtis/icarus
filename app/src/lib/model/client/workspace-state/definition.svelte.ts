import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { ContextView } from "$representation/data/types/workspace/views";
import type { Category, ContentView } from "$representation/data/types/workspace/categories";
import type {
  Frame,
  Inspected,
  Selection,
  TabId,
  Target
} from "$representation/data/types/workspace/tab";
import type { DocumentRuntime, DocumentRuntimesModel } from "$model/client/document-runtimes";
import type { SlideDeckRuntime, SlideDeckRuntimesModel } from "$model/client/slide-deck-runtimes";
import type { TabListModel } from "$model/client/tab-list";
import type { TabViewsModel } from "$model/client/tab-views";
import { activate } from "$model/client/workspace-state/methods/activate";
import { clear } from "$model/client/workspace-state/methods/clear";
import { close } from "$model/client/workspace-state/methods/close";
import { documentRuntime } from "$model/client/workspace-state/methods/document-runtime";
import { slideDeckRuntime } from "$model/client/workspace-state/methods/slide-deck-runtime";
import { flush } from "$model/client/workspace-state/methods/flush";
import { inspect } from "$model/client/workspace-state/methods/inspect";
import { open } from "$model/client/workspace-state/methods/open";
import { redo } from "$model/client/workspace-state/methods/redo";
import { reopenClosed } from "$model/client/workspace-state/methods/reopen-closed";
import { resize } from "$model/client/workspace-state/methods/resize";
import { restore } from "$model/client/workspace-state/methods/restore";
import { selectContext } from "$model/client/workspace-state/methods/select-context";
import { compose } from "$model/client/workspace-state/methods/shared/compose";
import { startingWorkspace } from "$model/client/workspace-state/methods/shared/defaults";
import { defaultContext, offersContext } from "$model/client/workspace-state/methods/shared/rails";
import { showContent } from "$model/client/workspace-state/methods/show-content";
import { showing } from "$model/client/workspace-state/methods/showing";
import { undo } from "$model/client/workspace-state/methods/undo";
import { zoom } from "$model/client/workspace-state/methods/zoom";
import type { Tab, WorkspaceStateModel, WorkspaceSync } from "$model/client/workspace-state/types";

export type Thresholds = { readonly afterOps: number; readonly afterMs: number };

export class WorkspaceStateData {
  log = $state<WorkspaceOp[]>([]);
  undone = $state<WorkspaceOp[]>([]);

  buffer = $state<WorkspaceOp[]>([]);
  revision = $state(0);
  sync = $state<WorkspaceSync>("loading");

  pendingFlush: Promise<void> | undefined;

  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    readonly project: string,
    readonly tabs: TabListModel,
    readonly views: TabViewsModel,
    readonly thresholds: Thresholds,
    readonly documents: DocumentRuntimesModel | undefined,
    readonly decks: SlideDeckRuntimesModel | undefined
  ) {
    const starting = startingWorkspace();
    for (const record of starting.tabs) {
      this.views.set(record.id, starting.views[record.id]);
      this.tabs.add(record);
    }
    this.tabs.activate(starting.activeId);
  }

  get afterOps(): number {
    return this.thresholds.afterOps;
  }

  get persists(): boolean {
    return this.thresholds.afterOps > 0;
  }

  compose(id: TabId): Tab {
    const record = this.tabs.find(id) ?? this.tabs.active;
    return compose(record, this.views.of(record.id));
  }

  armTimer(run: () => void): void {
    if (this.#timer !== undefined) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      run();
    }, this.thresholds.afterMs);
  }

  clearTimer(): void {
    if (this.#timer === undefined) return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
  }
}

export class WorkspaceState implements WorkspaceStateModel {
  readonly #state: WorkspaceStateData;

  constructor(
    project: string,
    tabs: TabListModel,
    views: TabViewsModel,
    thresholds: Thresholds,
    documents?: DocumentRuntimesModel,
    decks?: SlideDeckRuntimesModel
  ) {
    this.#state = new WorkspaceStateData(project, tabs, views, thresholds, documents, decks);
  }

  get project(): string {
    return this.#state.project;
  }

  get tabs(): readonly Tab[] {
    return this.#state.tabs.tabs.map((record) =>
      compose(record, this.#state.views.of(record.id))
    );
  }

  get activeId(): TabId {
    return this.#state.tabs.activeId;
  }

  get active(): Tab {
    return this.#state.compose(this.#state.tabs.activeId);
  }

  get frame(): Frame {
    return this.#state.views.of(this.#state.tabs.activeId).frame;
  }

  get context(): ContextView | undefined {
    const record = this.#state.tabs.active;
    const { contextId } = this.#state.views.of(record.id);
    return (
      (contextId !== null && offersContext(record.category, contextId)
        ? contextId
        : defaultContext(record.category)) ?? undefined
    );
  }

  get inspected(): Inspected {
    return this.#state.views.of(this.#state.tabs.activeId).inspected;
  }

  get selection(): Selection | undefined {
    return this.#state.views.of(this.#state.tabs.activeId).selection ?? undefined;
  }

  get canUndo(): boolean {
    return this.#state.log.length > 0;
  }

  get canRedo(): boolean {
    return this.#state.undone.length > 0;
  }

  get revision(): number {
    return this.#state.revision;
  }

  get sync(): WorkspaceSync {
    return this.#state.sync;
  }

  get pending(): number {
    return this.#state.buffer.length;
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

  showContent(content: ContentView, focus?: string): void {
    showContent(this.#state, content, focus);
  }

  selectContext(id: ContextView): void {
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

  get zoom(): number | null {
    return this.#state.views.of(this.#state.tabs.activeId).zoom;
  }

  setZoom(value: number): void {
    zoom(this.#state, value);
  }

  showing(category: Category, content?: ContentView): boolean {
    return showing(this.#state, category, content);
  }

  documentRuntime(resourceId: string): DocumentRuntime {
    return documentRuntime(this.#state, resourceId);
  }

  slideDeckRuntime(resourceId: string): SlideDeckRuntime {
    return slideDeckRuntime(this.#state, resourceId);
  }

  undo(): void {
    undo(this.#state);
  }

  redo(): void {
    redo(this.#state);
  }

  restore(): Promise<void> {
    return restore(this.#state);
  }

  flush(): Promise<void> {
    return flush(this.#state);
  }
}
