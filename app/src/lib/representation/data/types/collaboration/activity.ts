/**
 * A frozen reference. The label is a snapshot: an entry has to read correctly
 * after its subject is deleted, and "deleted a document" with no name is not an
 * audit record.
 *
 * Not a `ResourceRef` — activity records events on comments, threads,
 * memberships and variables, a wider space than the material a selection names.
 */
export type ActivityTarget = { kind: string; id: string; label: string };
