import { v, type Infer } from "convex/values";
import type { Id } from "$convex/_generated/dataModel";
import { latticeSourceValidator, type LatticeSource } from "$knowledge/types/lattice-source";

/**
 * A span of one source, as a node records it.
 *
 * `density` is how many windows merged into this one. At level 0 it is always 1;
 * above, two windows join only when they name the same source *and* overlap, and
 * the density is what tells a thin thematic link from a document's own argument
 * without re-reading a word.
 */
export const latticeWindowValidator = v.object({
  source: latticeSourceValidator,
  /** UTF-16 offsets into the source's text, like every other offset here. */
  start: v.number(),
  end: v.number(),
  density: v.number()
});

export type LatticeWindow = Infer<typeof latticeWindowValidator>;

/**
 * A window of text, or a cluster of them.
 *
 * At level 0 it is one window and carries that span's `text`; above, it is a
 * cluster with `members`, `count`, and `cohesion`, and its text is recoverable
 * from its windows rather than stored again per level.
 */
export type LatticeNode = {
  readonly id: Id<"latticeNodes">;
  readonly level: number;
  readonly tierSourceId?: string;
  readonly clustered: boolean;
  readonly windows: readonly LatticeWindow[];
  readonly text?: string;
  readonly centroid: readonly number[];
  readonly count?: number;
  readonly cohesion?: number;
  readonly tokens?: number;
  readonly members?: readonly Id<"latticeNodes">[];
  readonly parentId?: Id<"latticeNodes">;
  readonly staleAt?: number;
  readonly updatedAt: number;
};

/** One span of text ready to become a level-0 node: what it says and where it was. */
export type WindowPiece = {
  /** Content-addressed over `(source, text)` — the reuse key, not a stored field. */
  readonly id: string;
  readonly source: LatticeSource;
  readonly start: number;
  readonly end: number;
  readonly text: string;
};
