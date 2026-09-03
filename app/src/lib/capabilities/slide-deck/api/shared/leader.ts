import type { StoreModel } from "$model/server/store/index.server";
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
  const found = store.read("slideDeckSnapshots");
  if (found?.table !== "slideDeckSnapshots" || found.kind !== "table") return undefined;

  return found.rows.find(
    (row) =>
      row.projectId === projectId && row.resourceId === resourceId && row.role === "leader"
  );
};
