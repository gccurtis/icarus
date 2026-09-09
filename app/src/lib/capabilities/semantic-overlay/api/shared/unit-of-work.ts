import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";

/** The server graph while one Semantic Overlay publication owns an isolated Store view. */
export type SemanticUnitModel = Omit<ServerModel, "store"> & {
  readonly store: StoreUnitOfWork;
};

export const semanticUnitModel = (
  model: ServerModel,
  store: StoreUnitOfWork
): SemanticUnitModel => ({ ...model, store });
