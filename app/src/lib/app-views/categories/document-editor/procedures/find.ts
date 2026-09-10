import type { DocumentBody } from "$representation/data/types/documents/body";
import type { DocumentOp } from "$representation/data/types/documents/op";
import { blocksOf } from "$app-views/categories/document-editor/procedures/marks";
import { segmentsOf } from "$app-views/categories/document-editor/procedures/projection-atoms";

export type Hit = {
  readonly id: string;
  readonly blockId: string;
  readonly atomId: string;
  readonly offset: number;
  readonly from: number;
  readonly to: number;
  readonly before: string;
  readonly match: string;
  readonly after: string;
};

const CONTEXT = 24;

export const hitsOf = (
  body: DocumentBody | undefined,
  query: string,
  caseSensitive = false
): Hit[] => {
  if (body === undefined || query.length === 0) return [];

  const needle = caseSensitive ? query : query.toLowerCase();
  const hits: Hit[] = [];

  for (const block of blocksOf(body)) {
    const haystack = caseSensitive ? block.display : block.display.toLowerCase();
    const segments = segmentsOf(block.atoms);
    let from = haystack.indexOf(needle);

    while (from !== -1) {
      const to = from + query.length;
      const segment = segments.find(
        (held) => held.atom.kind === "literal" && held.start <= from && held.end >= to
      );

      if (segment !== undefined) {
        hits.push({
          id: `${block.id}@${from}`,
          blockId: block.id,
          atomId: segment.atom.id,
          offset: from - segment.start,
          from,
          to,
          before: block.display.slice(Math.max(0, from - CONTEXT), from),
          match: block.display.slice(from, to),
          after: block.display.slice(to, to + CONTEXT)
        });
      }

      from = haystack.indexOf(needle, from + Math.max(1, query.length));
    }
  }

  return hits;
};

export const addressOfHit = (hit: Hit, end: "from" | "to"): string =>
  `${hit.blockId}/atoms/${hit.atomId}@${end === "from" ? hit.offset : hit.offset + hit.match.length}`;

export const replaceOps = (hit: Hit, replacement: string): DocumentOp[] =>
  hit.match === replacement
    ? []
    : [
        {
          op: "text",
          target: "atom",
          path: `${hit.blockId}/atoms/${hit.atomId}`,
          at: hit.offset,
          insert: replacement,
          remove: hit.match
        }
      ];

export const replaceAllOps = (hits: readonly Hit[], replacement: string): DocumentOp[] =>
  [...hits]
    .sort((a, b) => (a.atomId === b.atomId ? b.offset - a.offset : 0))
    .flatMap((hit) => replaceOps(hit, replacement));
