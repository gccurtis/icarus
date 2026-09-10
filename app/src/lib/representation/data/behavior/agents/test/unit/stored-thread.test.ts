import { describe, expect, it } from "vitest";
import {
  isStoredThread,
  isStoredThreadPart
} from "$representation/data/behavior/agents/stored-thread";

const thread = () => ({
  _id: "threads:1",
  _creationTime: 1,
  projectId: "default",
  kind: "researchThread",
  branchedFrom: { threadId: "threads:root", messageId: "message-1", index: 0 }
});

const part = () => ({
  _id: "threadParts:1",
  _creationTime: 1,
  projectId: "default",
  threadId: "threads:1",
  part: 1,
  messages: [{
    id: "message-1",
    role: "prompt",
    author: { kind: "user", userId: "users:1" },
    sentAt: 1,
    blocks: [],
    attachments: [{ kind: "document", id: "documents:1" }],
    labels: ["review"],
    state: "complete"
  }]
});

describe("current thread storage", () => {
  it("admits the complete current thread and message partition", () => {
    expect(isStoredThread(thread())).toBe(true);
    expect(isStoredThreadPart(part())).toBe(true);
  });

  it("rejects partial messages, unknown nested fields, and duplicate message ids", () => {
    expect(isStoredThreadPart({ ...part(), messages: [{ id: "message-1" }] })).toBe(false);
    expect(isStoredThreadPart({
      ...part(),
      messages: [{ ...part().messages[0], citation: "retired" }]
    })).toBe(false);
    expect(isStoredThreadPart({ ...part(), messages: [part().messages[0], part().messages[0]] })).toBe(false);
  });

  it("does not coerce a thread kind object into the current union", () => {
    expect(isStoredThread({ ...thread(), kind: { toString: () => "researchThread" } })).toBe(false);
  });
});
