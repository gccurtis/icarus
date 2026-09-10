import {
  readCurrentRows,
  type StoreModel
} from "$model/server/store/index.server";
import { ensureSlideDeckReady } from "$representation/data/behavior/slide-decks/readiness";
import type { Id } from "$representation/data/types/core/id";
import type { SlideDeckBody } from "$representation/data/types/slide-decks/body";

export type Leader = {
  readonly _id: Id<"slideDeckSnapshots">;
  readonly revision: number;
  readonly body: SlideDeckBody;
};

export const leaderOf = (
  store: StoreModel,
  projectId: Id<"projects">,
  resourceId: Id<"slideDecks">
): Leader | undefined => {
  const leader = readCurrentRows(store, "slideDeckSnapshots").find(
    (row) =>
      row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
  );
  return leader === undefined
    ? undefined
    : { ...leader, body: ensureSlideDeckReady(leader.body) };
};
