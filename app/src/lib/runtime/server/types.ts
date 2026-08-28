import type { Configuration } from "$model/server/configuration/index.server";
import type { Observability } from "$model/server/observability/index.server";

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
  readonly configuration: Configuration;
  readonly observability: Observability;
  close(): Promise<void>;
}
