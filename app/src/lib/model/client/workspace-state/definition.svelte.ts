import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { ContextId } from "$representation/data/types/workspace/panels";
import type { Screen, Subscreen } from "$representation/data/types/workspace/screens";
import type {
  Frame,
  Inspected,
  Selection,
  TabId,
  Target
} from "$representation/data/types/workspace/tab";
import type { TabListModel } from "$model/client/tab-list";
import type { TabViewsModel } from "$model/client/tab-views";
import { activate } from "$model/client/workspace-state/methods/activate";
import { clear } from "$model/client/workspace-state/methods/clear";
import { close } from "$model/client/workspace-state/methods/close";
import { flush } from "$model/client/workspace-state/methods/flush";
import { inspect } from "$model/client/workspace-state/methods/inspect";
import { open } from "$model/client/workspace-state/methods/open";
import { redo } from "$model/client/workspace-state/methods/redo";
import { reopenClosed } from "$model/client/workspace-state/methods/reopen-closed";
import { resize } from "$model/client/workspace-state/methods/resize";
import { restore } from "$model/client/workspace-state/methods/restore";
import { selectContext } from "$model/client/workspace-state/methods/select-context";
import { compose } from "$model/client/workspace-state/methods/shared/compose";
import { SINGLETONS } from "$model/client/workspace-state/methods/shared/defaults";
import { mintView } from "$model/client/workspace-state/methods/shared/mint-view";
import { defaultContext, offersContext } from "$model/client/workspace-state/methods/shared/rails";
import { showSubscreen } from "$model/client/workspace-state/methods/show-subscreen";
import { showing } from "$model/client/workspace-state/methods/showing";
import { undo } from "$model/client/workspace-state/methods/undo";
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
    readonly thresholds: Thresholds
  ) {
    for (const screen of SINGLETONS) {
      const record = this.tabs.mint({ screen });
      this.views.set(record.id, mintView({ screen }));
      this.tabs.add(record);
    }
    this.tabs.activate(this.tabs.tabs[0].id);
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
    thresholds: Thresholds
  ) {
    this.#state = new WorkspaceStateData(project, tabs, views, thresholds);
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

  get context(): ContextId | undefined {
    const record = this.#state.tabs.active;
    const { subscreen, contextId } = this.#state.views.of(record.id);
    return contextId !== null && offersContext(record.screen, subscreen, contextId)
      ? contextId
      : defaultContext(record.screen, subscreen);
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

  showSubscreen(subscreen: Subscreen, focus?: string): void {
    showSubscreen(this.#state, subscreen, focus);
  }

  selectContext(id: ContextId): void {
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

  showing(screen: Screen, subscreen?: Subscreen): boolean {
    return showing(this.#state, screen, subscreen);
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
