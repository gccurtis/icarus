import { describe, expect, it } from "vitest";
import type { Doc } from "$convex/_generated/dataModel";
import { asThread } from "$research-threads/api/shared/as-thread";

const row = {
  _id: "researchThreads:1",
  _creationTime: 1_700_000_000_000,
  projectId: "projects:1",
  title: "Margin",
  mode: "question",
  questionId: "questions:1",
  createdBy: { kind: "user", userId: "users:1" },
  revision: 3,
  updatedAt: 1_700_000_000_500
} as unknown as Doc<"researchThreads">;

describe("asThread", () => {
  it("hands back the thread without the project it was read from", () => {
    // Every thread a caller gets back is from the project they asked about, so
    // repeating it per row says nothing.
    expect(asThread(row)).toEqual({
      id: "researchThreads:1",
      title: "Margin",
      mode: "question",
      questionId: "questions:1",
      hypothesisId: undefined,
      createdBy: { kind: "user", userId: "users:1" },
      revision: 3,
      updatedAt: 1_700_000_000_500
    });
  });

  it("adds nothing about the conversation", () => {
    // Turns are `messages.list(("research", id))`, which needs nothing from here.
    expect(asThread(row)).not.toHaveProperty("messages");
    expect(asThread(row)).not.toHaveProperty("chatId");
  });
});
