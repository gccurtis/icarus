import { describe, expect, it } from "vitest";

import { isStoredResearchTurn } from "$representation/data/behavior/investigation/stored-rows";

const common = () => ({
  _id: "researchTurns:1",
  _creationTime: 1,
  projectId: "default",
  researchThreadId: "researchThreads:1",
  threadId: "threads:1",
  promptMessageId: "prompt-1",
  prompt: "What changed?",
  mode: { kind: "explore" },
  scope: { kind: "project" },
  tools: [],
  blocks: [],
  queries: [],
  sources: [],
  findings: [],
  askedAt: 1,
  updatedAt: 1
});

const running = () => ({ ...common(), state: "running" });

const answered = () => ({
  ...common(),
  state: "answered",
  messageId: "response-1",
  usage: {
    requests: 1,
    promptTokens: 12,
    completionTokens: 3,
    totalTokens: 15
  },
  model: "provider/current-model",
  answeredAt: 2,
  updatedAt: 2
});

const failed = () => ({
  ...common(),
  state: "failed",
  error: "The provider did not finish.",
  updatedAt: 2
});

describe("current Research-turn storage", () => {
  it("admits each complete current lifecycle arm", () => {
    expect(isStoredResearchTurn(running())).toBe(true);
    expect(isStoredResearchTurn(answered())).toBe(true);
    expect(isStoredResearchTurn({ ...answered(), state: "insufficient" })).toBe(true);
    expect(isStoredResearchTurn(failed())).toBe(true);
    expect(isStoredResearchTurn({ ...failed(), state: "cancelled" })).toBe(true);
  });

  it("rejects the removed queued shape and every mixed lifecycle arm", () => {
    expect(isStoredResearchTurn({ ...running(), state: "queued" })).toBe(false);
    expect(isStoredResearchTurn({ ...running(), error: "old failure" })).toBe(false);
    expect(isStoredResearchTurn({ ...answered(), error: "also failed" })).toBe(false);
    expect(isStoredResearchTurn({ ...failed(), messageId: "response-1" })).toBe(false);
    expect(isStoredResearchTurn({ ...failed(), usage: answered().usage })).toBe(false);
    expect(isStoredResearchTurn({ ...failed(), answeredAt: 2 })).toBe(false);
  });

  it("rejects omitted terminal proof, duplicate choices, and incoherent time or usage", () => {
    const noUsage = answered() as Record<string, unknown>;
    delete noUsage.usage;
    expect(isStoredResearchTurn(noUsage)).toBe(false);
    expect(isStoredResearchTurn({ ...running(), tools: ["web.search", "web.search"] })).toBe(false);
    expect(isStoredResearchTurn({ ...answered(), answeredAt: 3 })).toBe(false);
    expect(isStoredResearchTurn({
      ...answered(),
      usage: { ...answered().usage, totalTokens: 99 }
    })).toBe(false);
  });

  it("rejects extra, symbolic, and explicitly undefined fields", () => {
    expect(isStoredResearchTurn({ ...running(), legacyState: "working" })).toBe(false);
    expect(isStoredResearchTurn({ ...running(), stopRequestedAt: undefined })).toBe(false);
    const symbolic = running() as Record<PropertyKey, unknown>;
    symbolic[Symbol("legacy")] = true;
    expect(isStoredResearchTurn(symbolic)).toBe(false);
  });
});
