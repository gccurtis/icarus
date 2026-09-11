import {
  readCurrentRows,
  type StoreModel
} from "$model/server/store/index.server";
import { ensurePresentationReady } from "$representation/data/behavior/presentations/readiness";
import type { Id } from "$representation/data/types/core/id";
import type { PresentationBody } from "$representation/data/types/presentations/body";

export type Leader = {
  readonly _id: Id<"presentationSnapshots">;
  readonly revision: number;
  readonly body: PresentationBody;
};

export const leaderOf = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"presentations">
): Leader | undefined => {
  const leader = readCurrentRows(store, "presentationSnapshots").find(
    (row) =>
      row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
  );
  return leader === undefined
    ? undefined
    : { ...leader, body: ensurePresentationReady(leader.body) };
};
