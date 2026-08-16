import { describe, expect, it } from "vitest";
import { personaThreadsTables } from "$persona-threads/schema";

const indexes = () => personaThreadsTables.personaThreads[" indexes"]();

describe("personaThreads schema", () => {
  it("leads every index with projectId", () => {
    expect(indexes().length).toBeGreaterThan(0);
    for (const index of indexes()) expect(index.fields[0]).toBe("projectId");
  });

  it("puts a persona's chats in one indexed read", () => {
    const byPersona = indexes().find((index) => index.indexDescriptor === "by_persona");

    expect(byPersona?.fields.slice(0, 2)).toEqual(["projectId", "personaId"]);
  });

  it("holds what the model states and nothing else", () => {
    // No status, no goal, no plan, no result: a chat is not a task, and giving
    // it a status would mean every question needs closing.
    expect(Object.keys(personaThreadsTables.personaThreads.validator.fields).sort()).toEqual(
      ["projectId", "personaId", "title", "branchedFrom", "createdBy", "updatedAt"].sort()
    );
  });

  it("records the message a branch continued from, and the thread it was in", () => {
    const branchedFrom = personaThreadsTables.personaThreads.validator.fields.branchedFrom;

    expect(branchedFrom.isOptional).toBe("optional");
    expect(Object.keys(branchedFrom.fields).sort()).toEqual(["messageId", "threadId"]);
    expect(branchedFrom.fields.threadId.tableName).toBe("personaThreads");
    expect(branchedFrom.fields.messageId.tableName).toBe("messages");
  });
});
