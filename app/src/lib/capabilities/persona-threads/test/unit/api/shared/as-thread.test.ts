import { describe, expect, it } from "vitest";
import type { Doc } from "$convex/_generated/dataModel";
import { asThread } from "$persona-threads/api/shared/as-thread";

const row = {
  _id: "personaThreads:1",
  _creationTime: 1,
  projectId: "projects:1",
  personaId: "personas:1",
  title: "Q3 margin",
  branchedFrom: { threadId: "personaThreads:0", messageId: "messages:4" },
  createdBy: { kind: "system" },
  updatedAt: 2
} as unknown as Doc<"personaThreads">;

describe("asThread", () => {
  it("keeps where the thread came from and drops which project it is in", () => {
    // `branchedFrom` is how the conversation before the branch is reached, so it
    // crosses the boundary; the project the caller is already scoped to does not.
    expect(asThread(row)).toEqual({
      id: "personaThreads:1",
      personaId: "personas:1",
      title: "Q3 margin",
      branchedFrom: { threadId: "personaThreads:0", messageId: "messages:4" },
      createdBy: { kind: "system" },
      updatedAt: 2
    });
  });
});
