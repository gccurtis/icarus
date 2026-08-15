/**
 * Every identifier Rich Content allocates. All of them come from
 * [`api/shared/ids.ts`](../api/shared/shared.md); a consumer never mints one.
 *
 * Aliases rather than branded types, because these cross the remote boundary and
 * a brand is erased on the way through anyway. What actually keeps one kind from
 * being passed where another is expected is the prefix each carries — an id is
 * self-describing in a stored `jsonb` row and in a log line.
 */
export type RichContentId = string;
export type AtomId = string;
export type DisplayLineId = string;
export type DisplaySegmentId = string;
export type ListId = string;
