import { describe, expect, it } from "vitest";

import { validateAsk } from "$capabilities/research-chat/api/ask/validate-ask";

const askWith = (scope: unknown): unknown => ({
  threadId: "researchThreads:one",
  text: "What changed?",
  scope
});

describe("research resource identity input", () => {
  it.each([
    { kind: "resource", ref: { kind: "externalFile", id: "externalFiles:one" } },
    { kind: "resource", ref: { kind: "externalFile::pdf", id: "externalFiles:one" } },
    { kind: "resource", ref: { kind: "document", id: "slideDecks:one" } },
    {
      kind: "resource",
      ref: { kind: "document", id: "documents:one", retired: true }
    },
    { kind: "resource", ref: { kind: "document", id: "documents:one" }, retired: true },
    { kind: "project", retired: true }
  ])("rejects a non-current scope %#", (scope) => {
    expect(() => validateAsk(askWith(scope))).toThrow();
  });

  it("admits one exact external resource scope", () => {
    expect(validateAsk(askWith({
      kind: "resource",
      ref: { kind: "externalFile::audio", id: "externalFiles:one" }
    }))).toEqual({
      threadId: "researchThreads:one",
      text: "What changed?",
      scope: {
        kind: "resource",
        ref: { kind: "externalFile::audio", id: "externalFiles:one" }
      },
      tools: []
    });
  });

  it("rejects unknown input fields, non-nominal thread ids, and unknown tools", () => {
    expect(() => validateAsk({
      threadId: "researchThreads:one",
      text: "What changed?",
      retired: true
    })).toThrow(/unknown field/);
    expect(() => validateAsk({ threadId: "one", text: "What changed?" })).toThrow(
      /researchThreads row id/
    );
    expect(() => validateAsk({
      threadId: "researchThreads:one",
      text: "What changed?",
      tools: ["old.search"]
    })).toThrow(/current research tool ids/);
  });

  it("rejects hidden, symbolic, accessor, and explicit-undefined command fields", () => {
    const hidden = {
      threadId: "researchThreads:one",
      text: "What changed?"
    };
    Object.defineProperty(hidden, "retired", { value: true });
    const symbolic = {
      threadId: "researchThreads:one",
      text: "What changed?"
    };
    Object.defineProperty(symbolic, Symbol("retired"), { value: true });
    const accessor = { text: "What changed?" } as Record<string, unknown>;
    Object.defineProperty(accessor, "threadId", {
      enumerable: true,
      get: () => "researchThreads:one"
    });
    for (const input of [hidden, symbolic, accessor, {
      threadId: "researchThreads:one",
      text: "What changed?",
      scope: undefined
    }]) {
      expect(() => validateAsk(input)).toThrow();
    }
  });
});
