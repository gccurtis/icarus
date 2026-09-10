import {
  readCurrentRows,
  type StoreModel
} from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import type { DocumentBody } from "$representation/data/types/documents/body";

export type Leader = {
  readonly _id: Id<"documentSnapshots">;
  readonly revision: number;
  readonly body: DocumentBody;
};

export const leaderOf = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"documents">
): Leader | undefined => {
  return readCurrentRows(store, "documentSnapshots").find(
    (row) =>
      row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
  );
};
