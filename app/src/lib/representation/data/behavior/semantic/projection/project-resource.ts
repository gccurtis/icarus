import type { ProjectResourceInput, ProjectSemanticProjection } from "$representation/data/behavior/semantic/projection/contract";
import { projectDocument } from "$representation/data/behavior/semantic/projection/resources/document";
import { projectSlideDeck } from "$representation/data/behavior/semantic/projection/resources/slide-deck";
import { projectionWriter } from "$representation/data/behavior/semantic/projection/writer";

/** One authoritative walk emits exact text and out-of-band material seeds. */
export const projectResource = (input: ProjectResourceInput): ProjectSemanticProjection => {
  if (!Number.isInteger(input.revision) || input.revision < 0) {
    throw new Error("A projected resource revision must be a non-negative integer");
  }
  if (input.ref.kind !== input.kind) {
    throw new Error("The resource reference kind must match the projected body kind");
  }
  const output = projectionWriter();
  // Resource names are navigation metadata, not authored evidence. Keeping the
  // title out also prevents demo timestamps from leaking into retrieved spans.
  const shared = {
    ref: input.ref,
    revision: input.revision,
    title: input.title,
    ...(input.externalFile === undefined ? {} : { externalFile: input.externalFile }),
    output
  };
  const materials = input.kind === "document"
    ? projectDocument(input.body, shared)
    : projectSlideDeck(input.body, shared);
  return {
    exact: {
      ref: { ...input.ref },
      revision: input.revision,
      encoding: "utf-16",
      ...output.finish()
    },
    materials
  };
};
