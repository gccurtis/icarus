import { describe, expect, it } from "vitest";

import {
  ConversationAggregateError,
  conversationAggregate
} from "$representation/data/behavior/agents/conversation";
import { asId } from "$representation/data/behavior/core/id";
import type { ThreadKind } from "$representation/data/types/agents/thread";

const projectId = asId<"projects">("projects:one");
const threadId = asId<"threads">("threads:one");
const thread = (project = projectId, kind: ThreadKind = "agentTask") => ({
  _id: threadId,
  _creationTime: 1,
  projectId: project,
  kind
});
const part = (project = projectId, number = 1) => ({
  _id: asId<"threadParts">(`threadParts:${number}`),
  _creationTime: number,
  projectId: project,
  threadId,
  part: number,
  messages: []
});

describe("conversation ownership aggregate", () => {
  it("returns only one exact same-project thread and its ordered parts", () => {
    expect(conversationAggregate(
      [thread()],
      [part(projectId, 2), part(projectId, 1)],
      projectId,
      threadId,
      "agentTask"
    ).parts.map((candidate) => candidate.part)).toEqual([1, 2]);
  });

  it.each([
    ["foreign thread", [thread(asId<"projects">("projects:other"))], [part()]],
    ["foreign part", [thread()], [part(asId<"projects">("projects:other"))]],
    ["wrong kind", [thread(projectId, "researchThread")], [part()]],
    ["missing parts", [thread()], []],
    ["duplicate part number", [thread()], [part(projectId, 1), part(projectId, 1)]]
  ] as const)("rejects a current-shape %s claimant", (_case, threads, parts) => {
    expect(() => conversationAggregate(
      threads,
      parts,
      projectId,
      threadId,
      "agentTask"
    )).toThrow(ConversationAggregateError);
  });
});
