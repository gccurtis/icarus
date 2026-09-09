import type {
  StoreUnitOfWork,
  TableRow
} from "$model/server/store/index.server";
import type { Id } from "$representation/data/types/core/id";
import { rowsOf } from "$capabilities/semantic-overlay/api/shared/rows";

export const currentOverlay = (
  store: StoreUnitOfWork,
  projectId: Id<"projects">
): TableRow<"semanticOverlays"> => {
  const overlay = rowsOf(store, "semanticOverlays")
    .filter((row) => row.projectId === projectId)
    .sort((left, right) =>
      right.generation - left.generation || right._creationTime - left._creationTime
    )[0];
  if (overlay === undefined) throw new Error("The project has no Semantic Overlay");
  return overlay;
};
