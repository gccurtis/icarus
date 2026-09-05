/**
 * Inversion belongs to the same function that applies, so an op and its
 * opposite can never disagree about what a field was called.
 */
export {
  invert,
  invertAll
} from "$representation/data/behavior/documents/apply-ops";
