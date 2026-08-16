import { describe, expect, it } from "vitest";
import { researchThreadModeValidator } from "$research-threads/types/research-thread";
import { researchThreadsTables } from "$research-threads/schema";

/**
 * The row *is* the thread, so the schema is where that is either true or quietly
 * abandoned: a `chatId` column would put back the conversation object the design
 * deliberately has none of, and an anchor routed through research links would
 * make every thread read a join to answer what it already knows.
 */
describe("researchThreads schema", () => {
  it("leads every index with projectId", () => {
    const indexes = researchThreadsTables.researchThreads[" indexes"]();

    expect(indexes.length).toBeGreaterThan(0);
    for (const index of indexes) expect(index.fields[0]).toBe("projectId");
  });

  it("reads a question's threads within the project", () => {
    const indexes = researchThreadsTables.researchThreads[" indexes"]();
    const byQuestion = indexes.find((index) => index.indexDescriptor === "by_question");

    expect(byQuestion?.fields.slice(0, 2)).toEqual(["projectId", "questionId"]);
  });

  it("holds its mode, what it is anchored to, and nothing about the conversation", () => {
    const fields = Object.keys(researchThreadsTables.researchThreads.validator.fields).sort();

    expect(fields).toEqual(
      [
        "projectId",
        "title",
        "mode",
        "questionId",
        "hypothesisId",
        "createdBy",
        "revision",
        "updatedAt"
      ].sort()
    );
  });

  it("is itself the thread, with no conversation object beside it", () => {
    const fields = researchThreadsTables.researchThreads.validator.fields;

    // Messages name this row and `by_thread(("research", id))` is the whole
    // link. A `chatId` would be a second copy of it to keep in sync.
    expect(fields).not.toHaveProperty("chatId");
    expect(fields).not.toHaveProperty("threadId");
    expect(fields).not.toHaveProperty("messages");
    expect(Object.keys(researchThreadsTables)).toEqual(["researchThreads"]);
  });

  it("anchors to a question or a hypothesis directly, not through a link", () => {
    const fields = researchThreadsTables.researchThreads.validator.fields;

    // A thread is *about* one thing and an anchor is singular, so routing it
    // through the many-to-many table would make every read a join.
    expect(fields.questionId.isOptional).toBe("optional");
    expect(fields.hypothesisId.isOptional).toBe("optional");
    expect(fields.mode).toBe(researchThreadModeValidator);
  });
});
