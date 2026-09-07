import type { MarkEnd } from "$representation/data/types/content/content-block";

export const CELL_ATOM = "text";

export const cellMarkEnd = (offset: number): MarkEnd => ({ atom: CELL_ATOM, offset });

export const cellOffsetOf = (end: MarkEnd): number => end.offset;
