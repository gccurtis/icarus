import { describe, expect, it } from "vitest";

import {
  admitContentBlocks,
  currentMarkLink,
  currentResourceRef
} from "$representation/data/behavior/content/admission";

describe("current content identity admission", () => {
  it("requires actor and persona links to name their represented tables", () => {
    expect(currentMarkLink({ kind: "actor", actor: { kind: "user", userId: "default-user" } })).toBe(true);
    expect(currentMarkLink({ kind: "actor", actor: { kind: "user", userId: "users:1" } })).toBe(true);
    expect(currentMarkLink({ kind: "actor", actor: { kind: "user", userId: "banana" } })).toBe(false);
    expect(currentMarkLink({ kind: "actor", actor: { kind: "agent", taskId: "users:1" } })).toBe(false);
    expect(currentMarkLink({ kind: "actor", actor: { kind: "connector", connectorId: "connector" } })).toBe(false);
    expect(currentMarkLink({ kind: "persona", personaId: "personas:1" })).toBe(true);
    expect(currentMarkLink({ kind: "persona", personaId: "users:1" })).toBe(false);
  });

  it("requires a resource kind and id namespace to agree", () => {
    expect(currentResourceRef({ kind: "document", id: "documents:1" })).toBe(true);
    expect(currentResourceRef({ kind: "document", id: "spreadsheets:1" })).toBe(false);
    expect(currentResourceRef({ kind: "finding", id: "findings:1" })).toBe(true);
    expect(currentResourceRef({ kind: "externalFile::image", id: "externalFiles:1" })).toBe(true);
    expect(currentResourceRef({ kind: "externalFile", id: "externalFiles:1" })).toBe(false);
    expect(currentResourceRef({ kind: "externalFile::pdf", id: "externalFiles:1" })).toBe(false);
    expect(currentResourceRef({
      kind: "externalFile::image",
      id: "externalFiles:1",
      subkind: "image"
    })).toBe(false);
    expect(currentResourceRef({ kind: "unknown", id: "unknown:1" })).toBe(false);
  });

  it("admits only primitive current discriminators and closed scope selectors", () => {
    const text = {
      id: "text",
      type: "text",
      variant: "paragraph",
      atoms: [{ id: "atom", kind: "literal", text: "Current" }],
      display: "Current",
      marks: []
    };
    expect(admitContentBlocks([text])).toBeDefined();
    expect(admitContentBlocks([{
      ...text,
      variant: { toString: () => "paragraph" }
    }])).toBeUndefined();

    const prompt = {
      id: "prompt",
      type: "prompt",
      atoms: [],
      display: "",
      marks: [],
      state: "idle"
    };
    expect(admitContentBlocks([{
      ...prompt,
      scope: { include: [{ select: "kinds", kinds: ["externalFile"] }], exclude: [] }
    }])).toBeDefined();
    expect(admitContentBlocks([{
      ...prompt,
      scope: { include: [{ select: "kinds", kinds: ["analysis"] }], exclude: [] }
    }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...prompt,
      scope: {
        include: [{
          select: "resources",
          refs: [{ kind: "externalFile", id: "externalFiles:1" }]
        }],
        exclude: []
      }
    }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...prompt,
      state: { toString: () => "idle" }
    }])).toBeUndefined();
  });

  it("requires every persisted content identity to use its nominal namespace", () => {
    const formula = {
      id: "block",
      type: "formula",
      expression: "1 + 1",
      formulaId: "formulas:1",
      display: "2",
      value: { kind: "number", value: 2 },
      state: "fresh"
    };
    expect(admitContentBlocks([formula])).toBeDefined();
    expect(admitContentBlocks([{ ...formula, formulaId: "banana" }])).toBeUndefined();

    const image = {
      id: "image",
      type: "image",
      alt: "Diagram",
      source: { kind: "file", fileId: "externalFiles:1" }
    };
    expect(admitContentBlocks([image])).toBeDefined();
    expect(admitContentBlocks([{ ...image, source: { kind: "file", fileId: "files:1" } }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...image,
      source: { kind: "storage", storageId: "_storage:1" }
    }])).toBeDefined();
    expect(admitContentBlocks([{
      ...image,
      source: { kind: "storage", storageId: "storage:1" }
    }])).toBeUndefined();

    const prompt = {
      id: "prompt",
      type: "prompt",
      derivedOutputId: "derivedOutputs:1",
      atoms: [],
      display: "",
      marks: [],
      state: "idle"
    };
    expect(admitContentBlocks([prompt])).toBeDefined();
    expect(admitContentBlocks([{
      id: "unconfigured-prompt",
      type: "prompt",
      atoms: [{ id: "prompt-atom", kind: "literal", text: "Text" }],
      display: "Text",
      marks: [],
      state: "idle"
    }])).toBeDefined();
    expect(admitContentBlocks([{ ...prompt, derivedOutputId: "outputs:1" }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...prompt,
      prompt: "What changed?",
      derivedOutputId: "derivedOutputs:1"
    }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...prompt,
      scope: { include: [{ select: "project" }], exclude: [] },
      derivedOutputId: "derivedOutputs:1"
    }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...prompt,
      derivedOutputId: undefined
    }])).toBeUndefined();
  });

  it("admits only the current resolved formula snapshot", () => {
    const atom = {
      id: "formula-atom",
      kind: "formula",
      expression: "revenue - cost",
      formulaId: "formulas:margin",
      lastResolvedValue: { kind: "number", value: 12 },
      lastResolvedDisplay: "12",
      state: "fresh"
    };
    const text = {
      id: "text",
      type: "text",
      variant: "paragraph",
      atoms: [atom],
      display: "12",
      marks: []
    };
    const block = {
      id: "formula-block",
      type: "formula",
      expression: "revenue - cost",
      formulaId: "formulas:margin",
      value: { kind: "number", value: 12 },
      display: "12",
      state: "fresh"
    };

    expect(admitContentBlocks([text, block])).toBeDefined();
    expect(admitContentBlocks([{
      ...text,
      atoms: [{ ...atom, formulaId: undefined }]
    }])).toBeUndefined();
    expect(admitContentBlocks([{ ...block, formulaId: undefined }])).toBeUndefined();

    for (const state of ["stale", "computing", "error"]) {
      expect(admitContentBlocks([{
        ...text,
        atoms: [{ ...atom, state }]
      }])).toBeUndefined();
      expect(admitContentBlocks([{ ...block, state }])).toBeUndefined();
    }

    expect(admitContentBlocks([{
      ...text,
      atoms: [{ ...atom, error: "division by zero" }]
    }])).toBeUndefined();
    expect(admitContentBlocks([{ ...block, error: "division by zero" }])).toBeUndefined();
    expect(admitContentBlocks([{ ...block, resolvedAt: 10 }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...text,
      atoms: [{
        id: atom.id,
        kind: atom.kind,
        expression: atom.expression,
        lastResolvedDisplay: atom.lastResolvedDisplay,
        state: atom.state
      }]
    }])).toBeUndefined();
  });

  it("admits each complete prompt lifecycle arm and rejects partial or mixed arms", () => {
    const presentation = {
      id: "prompt",
      type: "prompt",
      atoms: [{ id: "prompt-atom", kind: "literal", text: "Answer" }],
      display: "Answer",
      marks: []
    };
    const linked = {
      ...presentation,
      derivedOutputId: "derivedOutputs:answer"
    };

    expect(admitContentBlocks([{ ...presentation, state: "idle" }])).toBeDefined();
    expect(admitContentBlocks([{ ...linked, state: "idle" }])).toBeDefined();
    expect(admitContentBlocks([{ ...linked, state: "stale" }])).toBeDefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "stale",
      refreshedAt: 10
    }])).toBeDefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "fresh",
      refreshedAt: 10
    }])).toBeDefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "error",
      error: "generation failed"
    }])).toBeDefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "error",
      error: "generation failed",
      refreshedAt: 10
    }])).toBeDefined();

    expect(admitContentBlocks([{ ...presentation, state: "fresh", refreshedAt: 10 }])).toBeUndefined();
    expect(admitContentBlocks([{ ...presentation, state: "stale" }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...presentation,
      state: "error",
      error: "generation failed"
    }])).toBeUndefined();
    expect(admitContentBlocks([{ ...linked, state: "fresh" }])).toBeUndefined();
    expect(admitContentBlocks([{ ...linked, state: "error" }])).toBeUndefined();
    expect(admitContentBlocks([{ ...linked, state: "idle", refreshedAt: 10 }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "stale",
      error: "old failure"
    }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "fresh",
      refreshedAt: 10,
      error: "old failure"
    }])).toBeUndefined();
    expect(admitContentBlocks([{
      ...linked,
      state: "error",
      error: "   "
    }])).toBeUndefined();
    expect(admitContentBlocks([{ ...linked, state: "generating" }])).toBeUndefined();
  });

  it("rejects non-JSON object mechanics rather than reading a partial shape", () => {
    const current = {
      id: "text",
      type: "text",
      variant: "paragraph",
      atoms: [{ id: "atom", kind: "literal", text: "Current" }],
      display: "Current",
      marks: []
    };
    const hidden = { ...current };
    Object.defineProperty(hidden, "oldFormat", { value: true, enumerable: false });
    const symbol = { ...current, [Symbol("oldFormat")]: true };
    const accessor = { ...current };
    Object.defineProperty(accessor, "variant", {
      enumerable: true,
      get: () => "paragraph"
    });
    const inherited = Object.assign(Object.create({ retired: true }), current);
    const explicitUndefined = { ...current, format: undefined };

    expect(admitContentBlocks([hidden])).toBeUndefined();
    expect(admitContentBlocks([symbol])).toBeUndefined();
    expect(admitContentBlocks([accessor])).toBeUndefined();
    expect(admitContentBlocks([inherited])).toBeUndefined();
    expect(admitContentBlocks([explicitUndefined])).toBeUndefined();
  });
});
