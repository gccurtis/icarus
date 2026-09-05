import { coordinateLength, sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import type { SemanticCitation } from "$representation/data/types/semantic/derived-output";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

const refKey = (source: SemanticSourceSnapshot): string =>
  JSON.stringify([source.ref.kind, source.ref.id]);

const citationKey = (citation: SemanticCitation): string =>
  JSON.stringify([
    citation.source.ref.kind,
    citation.source.ref.id,
    citation.source.revision,
    citation.source.encoding,
    citation.overlayGeneration
  ]);

const assertCitation = (citation: SemanticCitation): void => {
  const { from, to, text } = citation.span;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
    throw new Error("semantic citation has invalid span coordinates");
  }
  if (coordinateLength(text, citation.source.encoding) !== to - from) {
    throw new Error("semantic citation text does not match its coordinates");
  }
  if (!Number.isInteger(citation.overlayGeneration) || citation.overlayGeneration < 0) {
    throw new Error("semantic citation has an invalid overlay generation");
  }
};

const merge = (citations: readonly SemanticCitation[]): SemanticCitation => {
  const ordered = [...citations].sort(
    (left, right) => left.span.from - right.span.from || left.span.to - right.span.to
  );
  const first = ordered[0];
  let from = first.span.from;
  let to = first.span.to;
  let text = first.span.text;

  for (const citation of ordered.slice(1)) {
    const sharedFrom = Math.max(from, citation.span.from);
    const sharedTo = Math.min(to, citation.span.to);
    const encoding = first.source.encoding;
    const existing = sliceByCoordinates(text, encoding, sharedFrom - from, sharedTo - from);
    const incoming = sliceByCoordinates(
      citation.span.text,
      encoding,
      sharedFrom - citation.span.from,
      sharedTo - citation.span.from
    );
    if (existing !== incoming) {
      throw new Error("overlapping semantic citations disagree on source text");
    }
    if (citation.span.to > to) {
      text += sliceByCoordinates(
        citation.span.text,
        encoding,
        to - citation.span.from,
        citation.span.to - citation.span.from
      );
      to = citation.span.to;
    }
  }

  return { source: first.source, span: { from, to, text }, overlayGeneration: first.overlayGeneration };
};

/** Unions overlapping reads from the same source snapshot and observed generation. */
export const coalesceSemanticCitations = (
  citations: readonly SemanticCitation[]
): SemanticCitation[] => {
  const groups = new Map<string, SemanticCitation[]>();
  for (const citation of citations) {
    assertCitation(citation);
    const key = citationKey(citation);
    groups.set(key, [...(groups.get(key) ?? []), citation]);
  }

  const result: SemanticCitation[] = [];
  for (const group of groups.values()) {
    const ordered = [...group].sort(
      (left, right) => left.span.from - right.span.from || left.span.to - right.span.to
    );
    let connected: SemanticCitation[] = [];
    let to = -1;
    for (const citation of ordered) {
      if (connected.length === 0 || citation.span.from < to) {
        connected.push(citation);
        to = Math.max(to, citation.span.to);
      } else {
        result.push(merge(connected));
        connected = [citation];
        to = citation.span.to;
      }
    }
    if (connected.length > 0) result.push(merge(connected));
  }

  return result.sort(
    (left, right) =>
      left.source.ref.kind.localeCompare(right.source.ref.kind) ||
      left.source.ref.id.localeCompare(right.source.ref.id) ||
      left.span.from - right.span.from ||
      left.overlayGeneration - right.overlayGeneration
  );
};

/** Returns each cited source snapshot whose active revision disappeared or changed. */
export const changedSemanticSources = (
  citations: readonly SemanticCitation[],
  active: readonly SemanticSourceSnapshot[]
): SemanticSourceSnapshot[] => {
  const activeByRef = new Map(active.map((source) => [refKey(source), source]));
  const changed = new Map<string, SemanticSourceSnapshot>();
  for (const citation of citations) {
    const current = activeByRef.get(refKey(citation.source));
    if (
      current === undefined ||
      current.revision !== citation.source.revision ||
      current.encoding !== citation.source.encoding
    ) {
      changed.set(
        JSON.stringify([
          refKey(citation.source),
          citation.source.revision,
          citation.source.encoding
        ]),
        citation.source
      );
    }
  }
  return [...changed.values()].sort(
    (left, right) =>
      left.ref.kind.localeCompare(right.ref.kind) || left.ref.id.localeCompare(right.ref.id)
  );
};
