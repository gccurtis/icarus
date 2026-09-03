import type { StoreModel } from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { TabId, TabRecord, TabView } from "$representation/data/types/workspace/tab";

export type Leader = {
  readonly _id: Id<"workspaceSnapshots">;
  readonly revision: number;
  readonly tabs: readonly TabRecord[];
  readonly activeId: TabId;
  readonly views: Readonly<Record<TabId, TabView>>;
};

export const leaderOf = (
  store: StoreModel,
  projectId: Id<"projects">,
  userId: Id<"users">
): Leader | undefined => {
  const found = store.read("workspaceSnapshots");
  if (found?.table !== "workspaceSnapshots" || found.kind !== "table") return undefined;

  return found.rows.find((row) => row.projectId === projectId && row.userId === userId);
};

/** Every change set accepted after a revision, oldest first. */
export const since = (
  store: StoreModel,
  projectId: Id<"projects">,
  userId: Id<"users">,
  revision: number
): readonly { readonly revision: number; readonly ops: readonly WorkspaceOp[] }[] => {
  const found = store.read("workspaceRevisions");
  if (found?.table !== "workspaceRevisions" || found.kind !== "table") return [];

  return found.rows
    .filter(
      (row) => row.projectId === projectId && row.userId === userId && row.revision > revision
    )
    .sort((a, b) => a.revision - b.revision);
};
