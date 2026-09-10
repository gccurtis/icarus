import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";
import { createOperationFlights } from "$model/server/operation-flights/index.server";
import type { OperationFlightsModel } from "$model/server/operation-flights/index.server";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const model = vi.hoisted(() => ({
  scope: { projectId: "p", userId: "u", username: "Uma" },
  tables: {} as Record<string, Row[]>,
  answered: [] as unknown[],
  logged: [] as { message: string; data: unknown }[],
  configuration: {
    get: (key: string) =>
      key === "intelligence.chat.topK"
        ? 8
        : key === "intelligence.chat.maxSources"
          ? 12
          : key === "intelligence.chat.model"
            ? "a/model"
            : key === "intelligence.chat.maxToolRounds"
              ? -1
              : key === "intelligence.chat.deadlineMs"
                ? 600_000
                : undefined
  },
  observability: {
    logger: {
      info: (message: string, data: unknown) => model.logged.push({ message, data }),
      warn: (message: string, data: unknown) => model.logged.push({ message, data })
    }
  },
  intelligence: { completeWithTools: () => Promise.reject(new Error("not stubbed")) },
  operationFlights: undefined as unknown as OperationFlightsModel,
  store: {
    create: (table: string, fields: unknown) => {
      const rows = (model.tables[table] ??= []);
      const id = `${table}:${rows.length + 1}`;
      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: Date.now() });
      return id;
    },
    read: (path: string) => {
      const [table] = path.split(".");
      return { table, kind: "table", rows: model.tables[table] ?? [] };
    },
    update: (path: string, value: unknown) => {
      const [table, id, ...fields] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      if (fields.length === 0) {
        rows[index] = {
          ...(value as Record<string, unknown>),
          _id: rows[index]._id,
          _creationTime: rows[index]._creationTime
        };
      } else {
        rows[index] = { ...rows[index], [fields[0]]: value };
      }
    },
    remove: (path: string) => {
      const [table, id, ...fields] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      if (fields.length === 0) rows.splice(index, 1);
      else {
        const copy = { ...rows[index] };
        delete copy[fields[0]];
        rows[index] = copy as Row;
      }
    },
    removeRows: (table: string, ids: readonly string[]) => {
      model.tables[table] = (model.tables[table] ?? []).filter((row) => !ids.includes(row._id));
    },
    transaction: <T>(work: (unit: unknown) => T): T => {
      const before = structuredClone(model.tables);
      try {
        return work(model.store);
      } catch (error) {
        model.tables = before;
        throw error;
      }
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve(model.scope)
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
  querySemanticOverlay: () => Promise.resolve({ overlayGeneration: 1, hits: [], usage: [], diagnostics: {} }),
  querySemanticMaterials: () => Promise.resolve({ overlayGeneration: 1, hits: [], usage: [], diagnostics: {} }),
  readSemanticResourceForModel: () => Promise.resolve(undefined)
}));

const { ask } = await import("$capabilities/research-chat/api/ask/ask");
const { createThread } = await import(
  "$capabilities/research-chat/api/create-thread/create-thread"
);
const { readThread } = await import("$capabilities/research-chat/api/read-thread/read-thread");
const { readThreads } = await import("$capabilities/research-chat/api/read-threads/read-threads");
const { removeThread } = await import(
  "$capabilities/research-chat/api/remove-thread/remove-thread"
);
const { setThreadPersona } = await import(
  "$capabilities/research-chat/api/set-thread-persona/set-thread-persona"
);
const { stopTurn } = await import("$capabilities/research-chat/api/stop-turn/stop-turn");
const { personaPrompt } = await import("$capabilities/research-chat/api/shared/prompts");

const persona = (id: string, tools: string[], scope?: unknown): Row => ({
  ...(scope === undefined ? {} : { scope }),
  _id: `personas:${id}`,
  _creationTime: 1,
  projectId: "p",
  name: `Persona ${id}`,
  definition: {
    focus: "Read the filings",
    background: "",
    approach: "Quote before you conclude",
    outputPreferences: "",
    verification: ""
  },
  tools,
  createdBy: { kind: "user", userId: "u" },
  revision: 1,
  updatedAt: 10
});

const chat = (id: string, extra: Partial<Row> = {}): Row => ({
  _id: `researchThreads:${id}`,
  _creationTime: 1,
  projectId: "p",
  threadId: `threads:${id}`,
  title: "A chat",
  mode: { kind: "explore" },
  findingIds: [],
  createdBy: { kind: "user", userId: "u" },
  updatedAt: 20,
  ...extra
});

beforeEach(() => {
  model.operationFlights?.close();
  model.operationFlights = createOperationFlights();
  model.tables = {
    personas: [
      persona("a", ["retrieve", "resource.read"]),
      persona("mute", []),
      persona("narrow", ["retrieve", "resource.read"], {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:1" }] }],
        exclude: []
      })
    ],
    researchThreads: [chat("one")],
    threads: [{ _id: "threads:one", _creationTime: 1, projectId: "p", kind: "researchThread" }],
    threadParts: [
      { _id: "threadParts:1", _creationTime: 1, projectId: "p", threadId: "threads:one", part: 1, messages: [] }
    ],
    researchTurns: [],
    resourceSets: [],
    documents: [],
    slideDecks: [],
    spreadsheets: [],
    semanticSources: [],
    semanticMaterials: []
  };
  model.logged = [];
  model.intelligence = { completeWithTools: () => Promise.reject(new Error("not stubbed")) };
});

const answers = (decision: Record<string, unknown>) => {
  model.intelligence = {
    completeWithTools: async (input: {
      tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
    }) => {
      const submit = input.tools.find((tool) => tool.name === "submit_answer");
      assert.notEqual(submit, undefined, "submit_answer must always be offered");
      await submit!.execute(decision);
      return {
        value: "",
        usage: { requestCount: 1, promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        toolCalls: [],
        rounds: 1
      };
    }
  } as never;
};

describe("reading", () => {
  test("lists the project's chats with their personas, newest first", async () => {
    model.tables.researchThreads.push(chat("two", { personaId: "personas:a", updatedAt: 90 }));
    const result = await readThreads();
    assert.deepEqual(
      result.threads.map((row) => row.id),
      ["researchThreads:two", "researchThreads:one"]
    );
    assert.equal(result.threads[0].personaName, "Persona a");
    assert.equal(result.threads[1].personaId, null);
    assert.deepEqual(
      result.personas.map((row) => row.name),
      ["Persona a", "Persona mute", "Persona narrow"]
    );
  });

  test("a chat in another project is absent rather than refused", async () => {
    model.tables.researchThreads.push(chat("elsewhere", { projectId: "other" }));
    assert.equal(await readThread({ threadId: "researchThreads:elsewhere" }), null);
  });
});

describe("creating", () => {
  test("opens a thread, its first part and the chat itself", async () => {
    const before = model.tables.threads.length;
    const result = await createThread({});
    assert.equal(model.tables.threads.length, before + 1);
    const made = model.tables.researchThreads.find((row) => row._id === result.threadId);
    assert.equal(made?.title, "New chat");
    assert.deepEqual(made?.mode, { kind: "explore" });
    const parts = model.tables.threadParts.filter((row) => row.threadId === made?.threadId);
    assert.equal(parts.length, 1);
    assert.deepEqual(parts[0].messages, []);
  });
});

describe("asking", () => {
  test("appends the question, publishes the answer and names the chat from it", async () => {
    answers({ status: "answered", sources: [], response: "Two feeders.", findings: [] });
    model.tables.researchThreads = [chat("one", { title: "New chat" })];
    const result = await ask({ threadId: "researchThreads:one", text: "Which feeders?" });
    assert.equal(result.accepted, true);

    const turn = model.tables.researchTurns[0];
    assert.equal(turn.state, "answered");
    assert.equal(turn.prompt, "Which feeders?");
    assert.equal((turn.blocks as { display: string }[])[0].display, "Two feeders.");
    assert.equal(model.tables.researchThreads[0].title, "Which feeders?");

    const messages = model.tables.threadParts[0].messages as { role: string }[];
    assert.deepEqual(
      messages.map((message) => message.role),
      ["prompt", "response"]
    );
  });

  test("an answer that cites nothing is still published as the answer", async () => {
    answers({ status: "answered", sources: [], response: "Partial.", findings: [] });
    await ask({ threadId: "researchThreads:one", text: "Anything?" });
    assert.equal(model.tables.researchTurns[0].state, "answered");
    assert.deepEqual(model.tables.researchTurns[0].sources, []);
  });

  test("insufficient publishes the refusal text and no sources", async () => {
    answers({ status: "insufficient", sources: [], response: "", findings: [] });
    await ask({ threadId: "researchThreads:one", text: "Anything?" });
    assert.equal(model.tables.researchTurns[0].state, "insufficient");
  });

  test("refuses a chat that is not this project's", async () => {
    const result = await ask({ threadId: "researchThreads:nope", text: "Hello" });
    assert.equal(result.accepted, false);
    assert.equal(result.accepted === false && result.reason, "not-found");
  });

  test("refuses a persona that may not read the project", async () => {
    model.tables.researchThreads = [chat("one", { personaId: "personas:mute" })];
    const result = await ask({ threadId: "researchThreads:one", text: "Hello" });
    assert.equal(result.accepted, false);
    assert.match(
      result.accepted === false ? result.detail : "",
      /may not read the project/
    );
  });

  test("a stranded running turn is reclaimed rather than blocking the chat forever", async () => {
    model.tables.researchTurns = [
      {
        _id: "researchTurns:stranded",
        _creationTime: 1,
        projectId: "p",
        researchThreadId: "researchThreads:one",
        threadId: "threads:one",
        promptMessageId: "m-1",
        prompt: "Earlier",
        mode: { kind: "explore" },
        scope: { kind: "project" },
        tools: [],
        state: "running",
        blocks: [],
        queries: [],
        sources: [],
        findings: [],
        askedAt: 1,
        updatedAt: 1
      }
    ];
    answers({ status: "answered", sources: [], response: "Fresh.", findings: [] });
    const result = await ask({ threadId: "researchThreads:one", text: "Again" });
    assert.equal(result.accepted, true);
    const stranded = model.tables.researchTurns.find((row) => row._id === "researchTurns:stranded");
    assert.equal(stranded?.state, "failed");
    assert.match(String(stranded?.error), /restarted/);
  });

  test("a provider failure is written on the turn rather than thrown at the caller", async () => {
    model.intelligence = {
      completeWithTools: () => Promise.reject(new Error("provider exploded"))
    } as never;
    const result = await ask({ threadId: "researchThreads:one", text: "Hello" });
    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "failed");
    assert.match(String(model.tables.researchTurns[0].error), /provider exploded/);
  });

  test("a credential in a failure message is redacted before it is stored", async () => {
    model.intelligence = {
      completeWithTools: () => Promise.reject(new Error("bad apiKey=sk-secret-value"))
    } as never;
    await ask({ threadId: "researchThreads:one", text: "Hello" });
    assert.doesNotMatch(String(model.tables.researchTurns[0].error), /sk-secret-value/);
  });
});

describe("a scoped persona", () => {
  test("cannot read outside its scope, whatever the turn asks for", async () => {
    model.tables.researchThreads = [chat("one", { personaId: "personas:narrow" })];
    let reachable: string[] = [];
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        const list = input.tools.find((tool) => tool.name === "list_resources");
        const seen = (await list!.execute({})) as { resources: { id: string }[] };
        reachable = seen.resources.map((row) => row.id);
        const read = input.tools.find((tool) => tool.name === "read_text");
        try {
          await read!.execute({ kind: "document", id: "documents:2", from: 0, to: 10 });
          reachable.push("read the excluded document");
        } catch {
          reachable.push("refused the excluded document");
        }
        const submit = input.tools.find((tool) => tool.name === "submit_answer");
        await submit!.execute({ status: "answered", sources: [], response: "Done.", findings: [] });
        return {
          value: "",
          usage: { requestCount: 1, promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          toolCalls: [],
          rounds: 1
        };
      }
    } as never;
    model.tables.documents = [
      { _id: "documents:1", _creationTime: 1, projectId: "p", title: "In scope" },
      { _id: "documents:2", _creationTime: 1, projectId: "p", title: "Out of scope" }
    ];

    await ask({ threadId: "researchThreads:one", text: "Anything" });
    assert.deepEqual(reachable, ["documents:1", "refused the excluded document"]);
  });
});

describe("the turn's own scope", () => {
  test("a resource scope narrows what every tool can reach", async () => {
    let reachable: string[] = [];
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        const list = input.tools.find((tool) => tool.name === "list_resources");
        const seen = (await list!.execute({})) as { resources: { id: string }[] };
        reachable = seen.resources.map((row) => row.id);
        const submit = input.tools.find((tool) => tool.name === "submit_answer");
        await submit!.execute({ status: "answered", sources: [], response: "Done.", findings: [] });
        return {
          value: "",
          usage: { requestCount: 1, promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          toolCalls: [],
          rounds: 1
        };
      }
    } as never;
    model.tables.documents = [
      { _id: "documents:1", _creationTime: 1, projectId: "p", title: "Chosen" },
      { _id: "documents:2", _creationTime: 1, projectId: "p", title: "Not chosen" }
    ];

    await ask({
      threadId: "researchThreads:one",
      text: "Anything",
      scope: { kind: "resource", ref: { kind: "document", id: "documents:1" } }
    });
    assert.deepEqual(reachable, ["documents:1"]);
    assert.deepEqual(model.tables.researchTurns[0].scope, {
      kind: "resource",
      ref: { kind: "document", id: "documents:1" }
    });
  });
});

describe("the persona prompt", () => {
  test("carries the written sections and leaves the empty ones out", () => {
    const prompt = personaPrompt({
      name: "Grid Analyst",
      definition: {
        focus: "Read the filings",
        background: "",
        approach: "Quote before you conclude",
        outputPreferences: "",
        verification: ""
      }
    });
    assert.match(prompt, /answering as Grid Analyst/);
    assert.match(prompt, /Read the filings/);
    assert.match(prompt, /Quote before you conclude/);
    assert.doesNotMatch(prompt, /What to assume the reader knows/);
  });
});

describe("the persona on a chat", () => {
  test("is set and cleared, and refuses one from another project", async () => {
    const set = await setThreadPersona({
      threadId: "researchThreads:one",
      personaId: "personas:a"
    });
    assert.equal(set.accepted, true);
    assert.equal(model.tables.researchThreads[0].personaId, "personas:a");

    const cleared = await setThreadPersona({ threadId: "researchThreads:one", personaId: null });
    assert.equal(cleared.accepted, true);
    assert.equal(model.tables.researchThreads[0].personaId, undefined);

    const missing = await setThreadPersona({
      threadId: "researchThreads:one",
      personaId: "personas:elsewhere"
    });
    assert.equal(missing.accepted, false);
  });
});

describe("stopping", () => {
  test("refuses a turn that is not running", async () => {
    answers({ status: "answered", sources: [], response: "Done.", findings: [] });
    const result = await ask({ threadId: "researchThreads:one", text: "Hello" });
    assert.equal(result.accepted, true);
    const stopped = await stopTurn({ threadId: "researchThreads:one" });
    assert.equal(stopped.accepted, false);
    assert.match(stopped.accepted === false ? stopped.detail : "", /nothing is running/);
  });

  test("asks the tools to answer now, then cancels on a second press", async () => {
    let seen: string[] = [];
    let stopControl: (() => Promise<unknown>) | undefined;
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        await stopControl?.();
        const search = input.tools.find((tool) => tool.name === "retrieve");
        const answer = (await search!.execute({ query: "anything" })) as { stopped?: boolean };
        seen.push(answer.stopped === true ? "stopped" : "searched");
        const submit = input.tools.find((tool) => tool.name === "submit_answer");
        await submit!.execute({
          status: "answered",
          sources: [],
          response: "What I had.",
          findings: []
        });
        return {
          value: "",
          usage: { requestCount: 1, promptTokens: 1, completionTokens: 1, totalTokens: 2 },
          toolCalls: [],
          rounds: 1
        };
      }
    } as never;
    stopControl = () => stopTurn({ threadId: "researchThreads:one" });

    const result = await ask({ threadId: "researchThreads:one", text: "Hello" });
    assert.equal(result.accepted, true);
    assert.deepEqual(seen, ["stopped"]);
    assert.equal(model.tables.researchTurns[0].state, "answered");
    assert.notEqual(model.tables.researchTurns[0].stopRequestedAt, undefined);
  });
});

describe("removing", () => {
  test("takes the turns, the parts, the thread and the chat", async () => {
    answers({ status: "answered", sources: [], response: "Done.", findings: [] });
    await ask({ threadId: "researchThreads:one", text: "Hello" });
    const result = await removeThread({ threadId: "researchThreads:one" });
    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchThreads.length, 0);
    assert.equal(model.tables.researchTurns.length, 0);
    assert.equal(model.tables.threadParts.length, 0);
    assert.equal(model.tables.threads.length, 0);
  });
});
