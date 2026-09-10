import { coalesceSemanticCitations } from "$representation/data/behavior/semantic/citation";
import type {
  MaterialDescriptorCitation,
  SemanticCitation
} from "$representation/data/types/semantic/derived-output";
import type { MaterialHit } from "$representation/data/types/semantic/material";
import type {
  EvidenceDraft,
  EvidenceSelection
} from "$capabilities/derived-output/api/shared/synthesis-types";

/** Turns a matched material facet into the exact descriptor text that may be cited. */
type MaterialDescriptorEvidence =
  | Pick<
      Extract<MaterialDescriptorCitation, { facet: "generated" }>,
      "facet" | "inputHash" | "text" | "model" | "promptVersion"
    >
  | Pick<
      Exclude<MaterialDescriptorCitation, { facet: "generated" }>,
      "facet" | "inputHash" | "text"
    >;

export const materialDescriptorEvidence = (hit: MaterialHit): MaterialDescriptorEvidence => {
  const textualMatch = hit.matched.find(
    (candidate): candidate is typeof candidate & { text: string } =>
      typeof candidate.text === "string" && candidate.text.trim().length > 0
  );
  if (textualMatch !== undefined) {
    if (textualMatch.facet === "generated") {
      if (hit.description?.provenance !== "generated") {
        throw new Error("generated material evidence is missing its current provenance");
      }
      return {
        facet: "generated",
        inputHash: textualMatch.inputHash,
        text: textualMatch.text,
        model: hit.description.model,
        promptVersion: hit.description.promptVersion
      };
    }
    return {
      facet: textualMatch.facet,
      inputHash: textualMatch.inputHash,
      text: textualMatch.text
    };
  }
  return {
    facet: "profile",
    inputHash: hit.profileFacet.inputHash,
    text: hit.profileFacet.text
  };
};

export const resolveEvidenceSelections = (
  selections: readonly EvidenceSelection[],
  issued: ReadonlyMap<string, EvidenceDraft>
): SemanticCitation[] =>
  coalesceSemanticCitations(
    selections.map((selection) => {
      const evidence = issued.get(selection.evidenceId);
      if (evidence === undefined) {
        throw new Error("selected evidence disappeared from its attempt");
      }
      return { ...evidence, selections: [selection] } as SemanticCitation;
    })
  );

export const validSelections = (
  selections: readonly EvidenceSelection[],
  issued: ReadonlyMap<string, EvidenceDraft>
): boolean =>
  selections.length > 0 &&
  new Set(selections.map((selection) => selection.evidenceId)).size === selections.length &&
  selections.every((selection) => issued.has(selection.evidenceId));
