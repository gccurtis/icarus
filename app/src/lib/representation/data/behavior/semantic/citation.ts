import { coordinateLength, sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import type {
  MaterialDescriptorCitation,
  MaterialNativeCitation,
  SemanticCitation,
  SemanticTextCitation
} from "$representation/data/types/semantic/derived-output";
import type { SemanticMaterialSnapshot } from "$representation/data/types/semantic/material";
import type { SemanticSourceSnapshot } from "$representation/data/types/semantic/source";

const isText = (citation: SemanticCitation): citation is SemanticTextCitation =>
  citation.evidenceKind === "text";

const refKey = (source: SemanticSourceSnapshot): string =>
  JSON.stringify([source.ref.kind, source.ref.id]);

const textKey = (citation: SemanticTextCitation): string =>
  JSON.stringify([
    citation.source.ref.kind,
    citation.source.ref.id,
    citation.source.revision,
    citation.source.contentHash ?? null,
    citation.source.encoding,
    citation.partition ?? null,
    citation.overlayGeneration
  ]);

const materialKey = (citation: MaterialDescriptorCitation | MaterialNativeCitation): string =>
  JSON.stringify([
    citation.evidenceKind,
    citation.material.materialId,
    citation.material.revisionKey,
    citation.evidenceKind === "descriptor" ? citation.facet : citation.selection,
    citation.overlayGeneration
  ]);

const assertSelections = (citation: SemanticCitation): void => {
  if (
    !Array.isArray(citation.selections) ||
    citation.selections.length === 0 ||
    citation.selections.some((selection) => !selection.evidenceId.trim() || !selection.use.trim())
  ) throw new Error("semantic citation requires selected evidence and its use");
  if (!Number.isInteger(citation.overlayGeneration) || citation.overlayGeneration < 0) {
    throw new Error("semantic citation has an invalid overlay generation");
  }
};

const assertText = (citation: SemanticTextCitation): void => {
  const { from, to, text } = citation.span;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
    throw new Error("semantic citation has invalid span coordinates");
  }
  if (coordinateLength(text, citation.source.encoding) !== to - from) {
    throw new Error("semantic citation text does not match its coordinates");
  }
  if (
    citation.locators !== undefined &&
    citation.locators.some((entry) =>
      !Number.isInteger(entry.from) ||
      !Number.isInteger(entry.to) ||
      entry.from < 0 ||
      entry.to <= entry.from ||
      entry.from >= to ||
      from >= entry.to
    )
  ) throw new Error("semantic citation has a locator outside its evidence span");
};

const mergedSelections = (citations: readonly SemanticCitation[]) => {
  const selections = new Map<string, string>();
  for (const citation of citations) for (const selection of citation.selections) {
    const existing = selections.get(selection.evidenceId);
    if (existing !== undefined && existing !== selection.use) {
      throw new Error("one evidence id has conflicting use annotations");
    }
    selections.set(selection.evidenceId, selection.use);
  }
  return [...selections].map(([evidenceId, use]) => ({ evidenceId, use }));
};

const mergeText = (citations: readonly SemanticTextCitation[]): SemanticTextCitation => {
  const ordered = [...citations].sort((left, right) =>
    left.span.from - right.span.from || left.span.to - right.span.to
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
    const incoming = sliceByCoordinates(citation.span.text, encoding, sharedFrom - citation.span.from, sharedTo - citation.span.from);
    if (existing !== incoming) throw new Error("overlapping semantic citations disagree on source text");
    if (citation.span.to > to) {
      text += sliceByCoordinates(citation.span.text, encoding, to - citation.span.from, citation.span.to - citation.span.from);
      to = citation.span.to;
    }
  }
  const locators = new Map<string, NonNullable<SemanticTextCitation["locators"]>[number]>();
  for (const citation of ordered) for (const locator of citation.locators ?? []) {
    locators.set(JSON.stringify(locator), locator);
  }
  return {
    evidenceKind: "text",
    selections: mergedSelections(ordered),
    source: first.source,
    span: { from, to, text },
    ...(locators.size === 0 ? {} : { locators: [...locators.values()] }),
    ...(first.partition === undefined ? {} : { partition: first.partition }),
    overlayGeneration: first.overlayGeneration
  };
};

/** Coalesces touching text while preserving typed material evidence as typed values. */
export const coalesceSemanticCitations = (
  citations: readonly SemanticCitation[]
): SemanticCitation[] => {
  for (const citation of citations) {
    assertSelections(citation);
    if (isText(citation)) assertText(citation);
  }
  const textGroups = new Map<string, SemanticTextCitation[]>();
  const materials = new Map<string, MaterialDescriptorCitation | MaterialNativeCitation>();
  for (const citation of citations) {
    if (isText(citation)) {
      const key = textKey(citation);
      textGroups.set(key, [...(textGroups.get(key) ?? []), citation]);
    } else {
      const key = materialKey(citation);
      const previous = materials.get(key);
      materials.set(key, previous === undefined
        ? citation
        : { ...previous, selections: mergedSelections([previous, citation]) });
    }
  }
  const text: SemanticTextCitation[] = [];
  for (const group of textGroups.values()) {
    const ordered = [...group].sort((left, right) => left.span.from - right.span.from || left.span.to - right.span.to);
    let connected: SemanticTextCitation[] = [];
    let to = -1;
    for (const citation of ordered) {
      if (connected.length === 0 || citation.span.from <= to) {
        connected.push(citation);
        to = Math.max(to, citation.span.to);
      } else {
        text.push(mergeText(connected));
        connected = [citation];
        to = citation.span.to;
      }
    }
    if (connected.length > 0) text.push(mergeText(connected));
  }
  return [
    ...text.sort((left, right) =>
      left.source.ref.kind.localeCompare(right.source.ref.kind) ||
      left.source.ref.id.localeCompare(right.source.ref.id) ||
      left.span.from - right.span.from
    ),
    ...[...materials.values()].sort((left, right) =>
      left.material.name.localeCompare(right.material.name) ||
      left.evidenceKind.localeCompare(right.evidenceKind)
    )
  ];
};

export const changedSemanticSources = (
  citations: readonly SemanticCitation[],
  active: readonly SemanticSourceSnapshot[]
): SemanticSourceSnapshot[] => {
  const activeByRef = new Map(active.map((source) => [refKey(source), source]));
  const changed = new Map<string, SemanticSourceSnapshot>();
  for (const citation of citations) {
    if (!isText(citation)) continue;
    const current = activeByRef.get(refKey(citation.source));
    if (
      current === undefined ||
      current.revision !== citation.source.revision ||
      current.contentHash !== citation.source.contentHash ||
      current.encoding !== citation.source.encoding
    ) {
      changed.set(JSON.stringify([
        refKey(citation.source),
        citation.source.revision,
        citation.source.contentHash ?? null,
        citation.source.encoding
      ]), citation.source);
    }
  }
  return [...changed.values()].sort((left, right) =>
    left.ref.kind.localeCompare(right.ref.kind) || left.ref.id.localeCompare(right.ref.id)
  );
};

export const changedSemanticMaterials = (
  citations: readonly SemanticCitation[],
  active: readonly SemanticMaterialSnapshot[]
): SemanticMaterialSnapshot[] => {
  const byId = new Map(active.map((material) => [material.materialId, material]));
  const changed = new Map<string, SemanticMaterialSnapshot>();
  for (const citation of citations) {
    if (isText(citation)) continue;
    const current = byId.get(citation.material.materialId);
    if (
      current === undefined ||
      current.revisionKey !== citation.material.revisionKey ||
      current.profileHash !== citation.material.profileHash ||
      current.contextHash !== citation.material.contextHash
    ) changed.set(citation.material.materialId, citation.material);
  }
  return [...changed.values()];
};
