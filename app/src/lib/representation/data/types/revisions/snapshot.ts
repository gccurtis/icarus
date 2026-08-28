/** `leader` anchors the hot read and `base` the cold one; a checkpoint bounds replay. */
export type SnapshotRole = "base" | "leader" | "checkpoint";

/** A field rather than two tables, so consolidation is a flag flip. */
export type ChangeTier = "recent" | "historical";
