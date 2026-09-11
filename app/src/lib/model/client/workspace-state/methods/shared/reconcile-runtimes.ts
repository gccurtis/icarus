import type { Category } from "$representation/data/types/workspace/categories";
import type { WorkspaceStateData } from "$model/client/workspace-state/definition.svelte";

const desired = (state: WorkspaceStateData, category: Category): Set<string> =>
  new Set(
    state.tabs.tabs
      .filter((tab) => tab.category === category)
      .flatMap((tab) => (tab.resourceId === undefined ? [] : [tab.resourceId]))
  );

const reconcile = (
  open: readonly string[],
  wanted: ReadonlySet<string>,
  attach: (id: string) => unknown,
  release: (id: string) => void
): void => {
  for (const id of open) if (!wanted.has(id)) release(id);
  for (const id of wanted) if (!open.includes(id)) attach(id);
};

/** Make runtime ownership match an adopted set of workspace tabs exactly. */
export const reconcileRuntimes = (state: WorkspaceStateData): void => {
  if (state.documents !== undefined) {
    const runtimes = state.documents;
    reconcile(
      runtimes.open,
      desired(state, "document-editor"),
      (id) => runtimes.attach(id),
      (id) => runtimes.release(id)
    );
  }
  if (state.presentations !== undefined) {
    const runtimes = state.presentations;
    reconcile(
      runtimes.open,
      desired(state, "presentation-editor"),
      (id) => runtimes.attach(id),
      (id) => runtimes.release(id)
    );
  }
  if (state.sheets !== undefined) {
    const runtimes = state.sheets;
    reconcile(
      runtimes.open,
      desired(state, "spreadsheet-editor"),
      (id) => runtimes.attach(id),
      (id) => runtimes.release(id)
    );
  }
};
