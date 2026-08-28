/**
 * What a back reference points at. A range keeps its corners and nothing between
 * them, because what a range covers depends on where its corners currently sit.
 */
export type BackReferenceTargetKind = "cell" | "range" | "name";
