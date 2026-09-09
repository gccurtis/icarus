import {
  changeSet,
  createSet,
  describeSet,
  draftOf,
  narrowed,
  nextSetName,
  removeSet,
  renameSet,
  termFor,
  withTerm,
  withWholeProject,
  withoutTerm,
  type OfferSource,
  type ResourceSetItem,
  type ScopeDraft,
  type ScopeSide
} from "$app-views/categories/project-overview/procedures/contexts";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

type Context = {
  readonly view: WorkspaceStateModel;
  readonly sets: () => readonly ResourceSetItem[];
};

/** Component-instance state and commands for the project's saved context sets. */
export class ContextsState {
  query = $state("");
  creating = $state(false);
  nameDraft = $state("");
  draft = $state<ScopeDraft>(withWholeProject());
  editing = $state<ResourceSetItem | undefined>(undefined);
  builderOpen = $state(false);
  pending = $state<string | undefined>(undefined);
  actionError = $state<string | undefined>(undefined);

  private live = true;

  constructor(private readonly context: Context) {}

  dispose(): void {
    this.live = false;
  }

  private async run(key: string, work: () => Promise<void>): Promise<void> {
    if (this.pending !== undefined) return;
    this.pending = key;
    this.actionError = undefined;
    try {
      await work();
    } catch (error) {
      if (this.live) this.actionError = error instanceof Error ? error.message : String(error);
    } finally {
      if (this.live) this.pending = undefined;
    }
  }

  create(): void {
    void this.run("create", async () => {
      const rule = narrowed(this.draft);
      if (rule === undefined) return;
      const name = this.nameDraft.trim() || nextSetName(this.context.sets());
      await createSet(this.context.view, name, rule);
      if (!this.live) return;
      this.creating = false;
      this.nameDraft = "";
      this.draft = withWholeProject();
    });
  }

  private change(item: ResourceSetItem): void {
    void this.run(`change:${item.id}`, async () => {
      const rule = narrowed(this.draft);
      if (rule === undefined) return;
      const result = await changeSet(this.context.view, item, rule);
      if (this.live && !result.accepted) this.actionError = result.detail;
    });
  }

  openBuilder(item?: ResourceSetItem): void {
    this.editing = item;
    this.draft = draftOf(item?.set ?? this.draft);
    this.builderOpen = true;
  }

  confirmBuilder(): void {
    const item = this.editing;
    if (item !== undefined) this.change(item);
    this.editing = undefined;
  }

  addTerm(side: ScopeSide, source: string, key: string): void {
    const term = termFor(source as OfferSource, key);
    if (term !== undefined) this.draft = withTerm(this.draft, side, term);
  }

  dropTerm(side: ScopeSide, key: string): void {
    this.draft = withoutTerm(this.draft, side, key);
  }

  setMode(whole: boolean): void {
    this.draft = whole ? withWholeProject() : { include: [], exclude: [] };
  }

  clearScope(): void {
    this.draft = { include: [], exclude: [] };
  }

  rename(item: ResourceSetItem, name: string): void {
    void this.run(`rename:${item.id}`, async () => {
      if (name.trim() === "" || name.trim() === item.name) return;
      const result = await renameSet(this.context.view, item, name);
      if (this.live && !result.accepted) this.actionError = result.detail;
    });
  }

  describe(item: ResourceSetItem, description: string): void {
    void this.run(`describe:${item.id}`, async () => {
      if (description.trim() === (item.description ?? "")) return;
      const result = await describeSet(this.context.view, item, description);
      if (this.live && !result.accepted) this.actionError = result.detail;
    });
  }

  remove(item: ResourceSetItem): void {
    void this.run(`remove:${item.id}`, async () => {
      if (!confirm(`Delete the set “${item.name}”?`)) return;
      const result = await removeSet(this.context.view, item);
      if (this.live && !result.accepted) this.actionError = result.detail;
    });
  }
}
