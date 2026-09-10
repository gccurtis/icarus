import { describe, expect, it } from "vitest";

import { isStoredSemanticCitation } from "$representation/data/behavior/semantic/stored-citations";

const textCitation = () => ({
  evidenceKind: "text",
  selections: [{ evidenceId: "evidence-1", use: "Supports the current answer" }],
  source: {
    ref: { kind: "document", id: "documents:source" },
    revision: 7,
    encoding: "utf-16"
  },
  span: { from: 0, to: 5, text: "alpha" },
  overlayGeneration: 4
});

const material = {
  materialId: "semanticMaterials:material",
  kind: "code",
  name: "Current source",
  source: {
    kind: "externalFile",
    ref: { kind: "externalFile::code", id: "externalFiles:source" },
    fileId: "externalFiles:source",
    hash: "source-hash",
    mediaType: "text/typescript",
    subkind: "code"
  },
  profileHash: "profile",
  contextHash: "context",
  revisionKey: "revision"
};

const descriptorCitation = () => ({
  evidenceKind: "descriptor",
  distance: 2,
  selections: [{ evidenceId: "evidence-1", use: "Supports the current answer" }],
  material,
  facet: "generated",
  text: "Generated current description",
  inputHash: "input",
  model: "current-model",
  promptVersion: "material-v1",
  overlayGeneration: 4
});

describe("stored semantic citations", () => {
  it("admits the exact explicitly discriminated text citation", () => {
    expect(isStoredSemanticCitation(textCitation())).toBe(true);
  });

  it("rejects the former untagged text citation instead of inferring its arm", () => {
    const { evidenceKind: _retiredAbsence, ...untagged } = textCitation();
    expect(isStoredSemanticCitation(untagged)).toBe(false);
  });

  it("rejects unknown discriminators and stale extra fields", () => {
    expect(isStoredSemanticCitation({ ...textCitation(), evidenceKind: "plainText" })).toBe(false);
    expect(isStoredSemanticCitation({ ...textCitation(), legacySourceId: "documents:source" })).toBe(false);
  });

  it("requires provenance exactly on the generated descriptor facet", () => {
    expect(isStoredSemanticCitation(descriptorCitation())).toBe(true);
    const { model: _model, ...withoutModel } = descriptorCitation();
    expect(isStoredSemanticCitation(withoutModel)).toBe(false);
    const { promptVersion: _promptVersion, ...withoutVersion } = descriptorCitation();
    expect(isStoredSemanticCitation(withoutVersion)).toBe(false);
    expect(isStoredSemanticCitation({ ...descriptorCitation(), model: "" })).toBe(false);

    const { model, promptVersion, ...profile } = descriptorCitation();
    expect(isStoredSemanticCitation({ ...profile, facet: "profile" })).toBe(true);
    expect(isStoredSemanticCitation({ ...profile, facet: "profile", model })).toBe(false);
    expect(isStoredSemanticCitation({ ...profile, facet: "profile", promptVersion })).toBe(false);
  });
});
