import { describe, expect, it } from "vitest";
import { threadRefValidator } from "$messages/types/thread";

/** The id validator differs per variant, so read it as a bag rather than narrowing. */
const idOf = (kind: string) => {
  const member = threadRefValidator.members.find((m) => m.fields.kind.value === kind);
  return member!.fields.id as unknown as { kind: string; tableName?: string };
};

describe("threadRefValidator", () => {
  it("discriminates the three things that are threads", () => {
    const kinds = threadRefValidator.members.map((member) => member.fields.kind.value).sort();

    // Each of the three *is* a thread. Nothing else is one.
    expect(kinds).toEqual(["persona", "research", "task"]);
  });

  it("names a thread by one id column, whichever table minted it", () => {
    for (const member of threadRefValidator.members) {
      expect(Object.keys(member.fields).sort()).toEqual(["id", "kind"]);
    }
  });

  it("names the table for every kind whose table exists", () => {
    // One column still, because a Convex id *is* a string — what tightening buys
    // is that a research turn cannot be posted against an id from anywhere else.
    expect(idOf("research").kind).toBe("id");
    expect(idOf("research").tableName).toBe("researchThreads");
  });

  it("leaves the kinds whose tables have not been built as strings", () => {
    // `personaThreads` arrives with task 22 and `agentTasks` in pass 7; each
    // tightens the same way there.
    for (const kind of ["persona", "task"]) expect(idOf(kind).kind).toBe("string");
  });
});
