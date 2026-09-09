import { describe, expect, it } from "vitest";

import { draftFor, keepDraft } from "$app-views/categories/research/procedures/drafts";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

const workspace = () => {
  const held = new Map<string, string>();
  const view = {
    draft: (key: string) => held.get(key) ?? "",
    keepDraft: (key: string, text: string) => {
      if (text === "") held.delete(key);
      else held.set(key, text);
    }
  } as unknown as WorkspaceStateModel;
  return { held, view };
};

describe("chat drafts", () => {
  it("keeps a draft per chat rather than per surface", () => {
    const { view } = workspace();

    keepDraft(view, "researchThreads:1", "half a question");
    keepDraft(view, "researchThreads:2", "a different one");

    expect(draftFor(view, "researchThreads:1")).toBe("half a question");
    expect(draftFor(view, "researchThreads:2")).toBe("a different one");
  });

  it("answers with nothing for a chat that has no draft", () => {
    const { view } = workspace();

    expect(draftFor(view, "researchThreads:9")).toBe("");
  });

  it("forgets a chat's draft once the field is empty", () => {
    const { held, view } = workspace();

    keepDraft(view, "researchThreads:1", "something");
    keepDraft(view, "researchThreads:1", "");

    expect(draftFor(view, "researchThreads:1")).toBe("");
    expect(held.size).toBe(0);
  });

  it("does nothing at all when there is no chat open", () => {
    const { held, view } = workspace();

    keepDraft(view, undefined, "typed with no chat");

    expect(draftFor(view, undefined)).toBe("");
    expect(held.size).toBe(0);
  });

  it("namespaces its keys, so another surface's draft cannot collide", () => {
    const { held, view } = workspace();

    keepDraft(view, "researchThreads:1", "mine");

    expect([...held.keys()]).toEqual(["research-chat:researchThreads:1"]);
  });
});
