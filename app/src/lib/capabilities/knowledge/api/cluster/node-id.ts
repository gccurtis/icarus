import { digest128 } from "$knowledge/api/shared/digest";

/** Distinct from a window's `w:`, so descent reads an artifact's kind off its id. */
const NODE_PREFIX = "n:";

/** No id contains it, so two different memberships cannot hash the same material. */
const SEPARATOR = "|";

/**
 * A cluster's identity: the hash of its **sorted** member ids.
 *
 * So identity is independent of member order and of when clustering ran —
 * re-clustering that produces the same grouping produces the same id. That is
 * what lets repair recognize an unchanged cluster instead of churning it, and it
 * is the reason nothing here mixes in a timestamp, a level, or a counter.
 *
 * The stored row still has its own `_id`: this is what the row *is*, the way a
 * window id is what a window is, and both are recomputed rather than stored
 * because a derived value that is written down can disagree with its source.
 */
export const nodeId = (memberIds: readonly string[]): string =>
  NODE_PREFIX + digest128([...memberIds].sort().join(SEPARATOR));
