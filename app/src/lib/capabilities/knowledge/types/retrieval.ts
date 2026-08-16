import type { LatticeSource } from "$knowledge/types/lattice-source";
import type { ResourceRef, SetExpression } from "$shared/types/set-expression";

/**
 * A window descent reached: where it is, what it says, and how well it scored.
 *
 * Not a stored row — it is the level-0 node's one window with its query score
 * attached, which is all region assembly is arithmetic over.
 */
export type ReachedWindow = {
  readonly source: LatticeSource;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly score: number;
};

/**
 * A contiguous span of one source, assembled from the windows that reached it.
 *
 * **Not the window list.** Windows overlap by design, so returning them raw
 * returns the same sentences repeatedly and spends the budget on duplicates.
 *
 * It names its `source` rather than a bare source id because a source here is a
 * kind and an id — the id alone decides
 * [admission](../api/shared/shared.md#scoped-retrieval), and the kind is what
 * lets whatever quotes the region open what it quoted.
 */
export type Region = {
  readonly source: LatticeSource;
  /** UTF-16 offsets into the source's text, like every other offset here. */
  readonly start: number;
  readonly end: number;
  /** **Verbatim.** No summarizing, no trimming to a sentence boundary. */
  readonly text: string;
  /** The best covering window's score, never an average. */
  readonly relevance: number;
  /** How many retrieved windows cover the span. */
  readonly density: number;
};

/**
 * What a scoped answer resolved against, and what makes it checkable.
 *
 * "Why was this not found" has an answer: either the source was not admissible,
 * or it was and descent did not reach it, and this is what distinguishes those
 * two.
 *
 * **`resolvedAt` is in neither digest.** An identical scope resolved twice
 * produces identical digests, which is the whole point of recording them — a
 * timestamp inside one would make every resolution look like a different scope.
 */
export type ScopeManifest = {
  /** What the caller asked for, before anything was looked up. */
  readonly input: SetExpression;
  /** What it selected: deduplicated and canonically ordered. */
  readonly entries: readonly ResourceRef[];
  /** The admissible set windows are filtered against, sorted. */
  readonly sourceIds: readonly string[];
  readonly inputDigest: string;
  readonly scopeDigest: string;
  readonly resolvedAt: number;
};

/** A query, the scope it may be narrowed to, and how many regions are wanted. */
export type RetrievalRequest = {
  readonly query: string;
  /** Absent — or naming nothing — searches the whole lattice. */
  readonly scope?: SetExpression;
  readonly limit?: number;
};

/**
 * Regions and the scope they were admitted under.
 *
 * **Nothing here is stored as its own record.** A retrieval is a step in
 * producing a [message](../../../../../../docs/data-models/core/message.md) and
 * is recorded there as a tool call.
 */
export type Retrieval = {
  readonly regions: readonly Region[];
  /** Null when no scope was applied, which is not the same as one that admitted nothing. */
  readonly scope: ScopeManifest | null;
};
