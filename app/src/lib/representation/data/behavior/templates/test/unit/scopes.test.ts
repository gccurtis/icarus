import { describe, expect, it } from "vitest";

import type { PromptBlock } from "$representation/data/types/content/content-block";
import type { TemplatedTerm } from "$representation/data/types/core/resource-set";
import type { TemplateBody, TemplateVariable } from "$representation/data/types/templates/template";
import {
  resolveTemplateScopes,
  variableNamesIn
} from "$representation/data/behavior/templates/scopes";

const prompt = (id: string, include: TemplatedTerm[]): PromptBlock => ({
  id,
  type: "prompt",
  atoms: [{ id: `${id}-a`, kind: "literal", text: "Summarise" }],
  display: "Summarise",
  marks: [],
  scope: { include, exclude: [] },
  state: "idle"
});

const body = (blocks: PromptBlock[]): TemplateBody => ({
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks }]
});

const scopeOf = (held: TemplateBody, blockId: string) => {
  if (held.resource !== "document") throw new Error("a document was expected");
  const row = held.rows[0];
  if (row.kind !== "blocks") throw new Error("a blocks row was expected");
  const block = row.blocks.find((candidate) => candidate.id === blockId);
  return block?.type === "prompt" ? block.scope : undefined;
};

const evidence: TemplateVariable = {
  name: "evidence",
  label: "Evidence",
  default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
};

describe("resolveTemplateScopes", () => {
  it("fills a variable term from its default", () => {
    const resolved = resolveTemplateScopes(body([prompt("p", [{ select: "variable", name: "evidence" }])]), [evidence]);
    expect(resolved.accepted).toBe(true);
    if (!resolved.accepted) return;
    expect(resolved.undeclared).toEqual([]);
    expect(scopeOf(resolved.body, "p")).toEqual({
      include: [{ select: "kinds", kinds: ["finding"] }],
      exclude: []
    });
  });

  it("prefers the caller's answer to the default", () => {
    const resolved = resolveTemplateScopes(
      body([prompt("p", [{ select: "variable", name: "evidence" }])]),
      [evidence],
      { evidence: { include: [{ select: "set", setId: "resourceSets:2" as never }], exclude: [] } }
    );
    if (!resolved.accepted) throw new Error(resolved.detail);
    expect(scopeOf(resolved.body, "p")).toEqual({
      include: [{ select: "set", setId: "resourceSets:2" }],
      exclude: []
    });
  });

  it("means the whole project for a variable declared without a default", () => {
    const resolved = resolveTemplateScopes(
      body([prompt("p", [{ select: "variable", name: "models" }])]),
      [{ name: "models", label: "Models" }]
    );
    if (!resolved.accepted) throw new Error(resolved.detail);
    expect(scopeOf(resolved.body, "p")).toEqual({ include: [{ select: "project" }], exclude: [] });
  });

  it("keeps the term and reports a name the template does not declare", () => {
    const resolved = resolveTemplateScopes(
      body([prompt("p", [{ select: "variable", name: "evidence" }, { select: "variable", name: "models" }])]),
      [evidence]
    );
    if (!resolved.accepted) throw new Error(resolved.detail);
    expect(resolved.undeclared).toEqual(["models"]);
    expect(scopeOf(resolved.body, "p")).toEqual({
      include: [{ select: "kinds", kinds: ["finding"] }, { select: "variable", name: "models" }],
      exclude: []
    });
  });

  it("refuses a default that excludes, because a difference does not flatten", () => {
    const resolved = resolveTemplateScopes(body([prompt("p", [{ select: "variable", name: "evidence" }])]), [
      { ...evidence, default: { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] } }
    ]);
    expect(resolved).toMatchObject({ accepted: false, reason: "unsupported-body" });
  });

  it("treats a variable that reaches itself as the whole project", () => {
    const resolved = resolveTemplateScopes(body([prompt("p", [{ select: "variable", name: "loop" }])]), [
      { name: "loop", label: "Loop", default: { include: [{ select: "variable", name: "loop" }], exclude: [] } }
    ]);
    if (!resolved.accepted) throw new Error(resolved.detail);
    expect(scopeOf(resolved.body, "p")).toEqual({ include: [{ select: "project" }], exclude: [] });
  });

  it("lists the variable names a body refers to", () => {
    const held = body([
      prompt("p", [{ select: "variable", name: "b" }]),
      prompt("q", [{ select: "variable", name: "a" }, { select: "kinds", kinds: ["document"] }])
    ]);
    expect(variableNamesIn(held)).toEqual(["a", "b"]);
  });
});
