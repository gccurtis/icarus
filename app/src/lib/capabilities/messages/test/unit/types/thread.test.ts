import { describe, expect, it } from "vitest";
import { threadRefValidator } from "$messages/types/thread";

describe("threadRefValidator", () => {
  it("discriminates the three things that are threads", () => {
    const kinds = threadRefValidator.members.map((member) => member.fields.kind.value).sort();

    // Each of the three *is* a thread. Nothing else is one.
    expect(kinds).toEqual(["persona", "research", "task"]);
  });

  it("names a thread by one id column, whichever table minted it", () => {
    for (const member of threadRefValidator.members) {
      expect(Object.keys(member.fields).sort()).toEqual(["id", "kind"]);
      // One indexed column: a union of `v.id`s would make every reader choose a
      // branch to render one conversation.
      expect(member.fields.id.kind).toBe("string");
    }
  });
});
