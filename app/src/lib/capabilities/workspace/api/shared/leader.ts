import {
  readCurrentRows,
  type StoreUnitOfWork
} from "$model/server/store/index.server";
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

type StoreReads = Pick<StoreUnitOfWork, "read">;

export const leaderOf = (
  store: StoreReads,
  projectId: Id<"projects">,
  userId: Id<"users">
): Leader | undefined => {
  const leaders = readCurrentRows(store, "workspaceSnapshots").filter(
    (row) => row.projectId === projectId && row.userId === userId
  );
  if (leaders.length > 1) {
    throw new Error("A project member has more than one workspace leader");
  }
  return leaders[0];
};

/** The complete contiguous revision history for one project member, oldest first. */
export const historyOf = (
  store: StoreReads,
  projectId: Id<"projects">,
  userId: Id<"users">
): readonly { readonly revision: number; readonly ops: readonly WorkspaceOp[] }[] => {
  const history = readCurrentRows(store, "workspaceRevisions")
    .filter((row) => row.projectId === projectId && row.userId === userId)
    .sort((a, b) => a.revision - b.revision);
  if (history.some((row, index) => row.revision !== index + 1)) {
    throw new Error("A project member's workspace revision history is not contiguous");
  }
  return history;
};
