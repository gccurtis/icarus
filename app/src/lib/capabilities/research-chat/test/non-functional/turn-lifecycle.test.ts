import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createOperationFlights } from "$model/server/operation-flights/index.server";
import { defineStore, type StoreModel } from "$model/server/store/index.server";

const harness = vi.hoisted(() => ({
  model: undefined as unknown,
  scope: { projectId: "", userId: "", username: "Uma" }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => harness.model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve(harness.scope)
}));
vi.mock("$capabilities/semantic-overlay", () => ({
  enqueueSemanticSync: () => Promise.resolve(null),
  processSemanticSyncQueueFor: () =>
    Promise.resolve({
      processed: [],
      remaining: 0,
      failed: [],
      materials: { processed: [], remaining: 0, failed: [] }
    }),
  semanticSourceIsCurrent: () => true,
  querySemanticOverlay: () => Promise.resolve({ hits: [] }),
  querySemanticMaterials: () => Promise.resolve({ hits: [] }),
  readSemanticResourceForModel: () => Promise.resolve(undefined)
}));

const { ask } = await import("$capabilities/research-chat/api/ask/ask");

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const rows = (store: StoreModel, table: string): Array<Record<string, unknown>> => {
  const found = store.read(table);
  return found?.kind === "table"
    ? found.rows.map((row) => row as unknown as Record<string, unknown>)
    : [];
};

describe("durable research-turn lifecycle", () => {
  test("a prompt and running turn survive together before the answer finishes, then the answer survives reload", async () => {
    const directory = mkdtempSync(join(tmpdir(), "icarus-research-turn-"));
    directories.push(directory);
    const store = defineStore({ directory, now: () => 1000 });
    const projectId = store.create("projects", {
      name: "Project",
      revision: 1,
      settings: "{}",
      updatedAt: 1000
    });
    const userId = store.create("users", {
      authSubject: "test:uma",
      displayName: "Uma",
      settings: "{}",
      updatedAt: 1000
    });
    const threadId = store.create("threads", { projectId, kind: "researchThread" });
    store.create("threadParts", { projectId, threadId, part: 1, messages: [] });
    const researchThreadId = store.create("researchThreads", {
      projectId,
      threadId,
      title: "New chat",
      mode: { kind: "explore" },
      findingIds: [],
      createdBy: { kind: "user", userId },
      updatedAt: 1000
    });

    let entered!: () => void;
    const providerEntered = new Promise<void>((resolve) => (entered = resolve));
    let finish!: () => void;
    const mayFinish = new Promise<void>((resolve) => (finish = resolve));
    const intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute(value: unknown): Promise<unknown> }[];
      }) => {
        entered();
        await mayFinish;
        const submit = input.tools.find((tool) => tool.name === "submit_answer");
        await submit?.execute({
          status: "answered",
          sources: [],
          response: "The durable answer.",
          findings: []
        });
        return {
          value: "",
          usage: { requestCount: 1, promptTokens: 2, completionTokens: 3, totalTokens: 5 },
          toolCalls: [],
          rounds: 1
        };
      }
    };
    const configuration = {
      get: (key: string) =>
        key === "intelligence.chat.topK"
          ? 8
          : key === "intelligence.chat.maxSources"
            ? 12
            : key === "intelligence.chat.model"
              ? "test/model"
              : key === "intelligence.chat.maxToolRounds"
                ? 8
                : key === "intelligence.chat.deadlineMs"
                  ? 60_000
                  : undefined
    };
    harness.scope = { projectId, userId, username: "Uma" };
    harness.model = {
      store,
      intelligence,
      configuration,
      operationFlights: createOperationFlights(),
      observability: { logger: { info: () => {}, warn: () => {} } }
    };

    const pending = ask({ threadId: researchThreadId, text: "Will this survive?" });
    await providerEntered;

    const whileRunning = defineStore({ directory });
    expect(rows(whileRunning, "researchTurns")).toMatchObject([
      { prompt: "Will this survive?", state: "running" }
    ]);
    expect(rows(whileRunning, "threadParts")[0].messages).toMatchObject([
      { role: "prompt" }
    ]);
    expect(rows(whileRunning, "researchThreads")[0].title).toBe("Will this survive?");

    finish();
    await expect(pending).resolves.toMatchObject({ accepted: true });

    const afterReload = defineStore({ directory });
    expect(rows(afterReload, "researchTurns")).toMatchObject([
      {
        prompt: "Will this survive?",
        state: "answered",
        blocks: [{ type: "text", display: "The durable answer." }]
      }
    ]);
    expect(rows(afterReload, "threadParts")[0].messages).toMatchObject([
      { role: "prompt" },
      { role: "response" }
    ]);
  });
});
