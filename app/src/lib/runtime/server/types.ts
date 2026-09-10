import type { OperationFlightsModel } from "$model/server/operation-flights/index.server";
import type { IntelligenceModel } from "$model/server/intelligence/index.server";
import type { EmbeddingModel } from "$model/server/embedding/index.server";
import type { Configuration } from "$model/server/configuration/index.server";
import type { Observability } from "$model/server/observability/index.server";
import type { StoreModel } from "$model/server/store/index.server";
import type { ExternalFileStorageModel } from "$model/server/external-file-storage/index.server";

/**
 * The server model: everything held for one process's lifetime.
 *
 * These are model *objects* rather than capabilities because each owns a
 * resource with a lifetime — a parsed snapshot, an open log stream. Capabilities
 * own rows, hold nothing between requests, and are procedural.
 *
 * Named rather than inferred from the constructor, because the consumers that
 * matter have to name it: the request that carries it on its locals, the test
 * that substitutes one object, the helper that takes the graph as a parameter.
 *
 * One field per object. A second name for something an object already exposes —
 * `logger` beside the `observability` that owns it — makes the graph disagree
 * with itself the moment either side moves, and buys a caller one property
 * access.
 */
export interface ServerModel {
  readonly operationFlights: OperationFlightsModel;
  readonly intelligence: IntelligenceModel;
  readonly embedding: EmbeddingModel;
  readonly configuration: Configuration;
  readonly observability: Observability;
  readonly store: StoreModel;
  readonly externalFileStorage: ExternalFileStorageModel;
  close(): Promise<void>;
}
