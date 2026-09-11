import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";
import { createOperationFlights } from "$model/server/operation-flights/index.server";
import type { OperationFlightsModel } from "$model/server/operation-flights/index.server";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };
type SemanticFailure = {
  readonly jobId: string;
  readonly ref: { readonly kind: string; readonly id: string };
  readonly error?: string;
};
type SemanticProcessResult = {
  readonly processed: readonly unknown[];
  readonly remaining: number;
  readonly failed: readonly SemanticFailure[];
  readonly materials: {
    readonly processed: readonly unknown[];
    readonly remaining: number;
    readonly failed: readonly SemanticFailure[];
  };
};
type SemanticEnqueueResult = {
  readonly ref: { readonly kind: string; readonly id: string };
  readonly revision: number;
  readonly jobId?: string;
  readonly materialJobId?: string;
} | null;
type SemanticQueryResult = {
  readonly overlayGeneration: number;
  readonly hits: readonly unknown[];
  readonly usage: readonly unknown[];
  readonly diagnostics: Record<string, unknown>;
};

const model = vi.hoisted(() => ({
  scope: { projectId: "projects:p", userId: "users:u", username: "Uma" },
  tables: {} as Record<string, Row[]>,
  answered: [] as unknown[],
  logged: [] as { message: string; data: unknown }[],
  requestScopes: 0,
  configuration: {
    get: (key: string): unknown =>
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
      info: (message: string, data: unknown) => {
        model.logged.push({ message, data });
      },
      warn: (message: string, data: unknown) => {
        model.logged.push({ message, data });
      }
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

const semantic = vi.hoisted(() => ({
  enqueued: [] as Array<{ model: unknown; projectId: string; ref: { kind: string; id: string } }>,
  requested: [] as Array<{ kind: string; id: string } | undefined>,
  signals: [] as Array<AbortSignal | undefined>,
  querySignals: [] as Array<AbortSignal | undefined>,
  readSignals: [] as Array<AbortSignal | undefined>,
  enqueue: (
    ref: { kind: string; id: string },
    signal?: AbortSignal
  ): Promise<SemanticEnqueueResult> => {
    signal?.throwIfAborted();
    const suffix = ref.id.split(":").at(-1);
    return Promise.resolve({
      ref,
      revision: 1,
      jobId: `semanticSyncJobs:${suffix}`,
      materialJobId: `semanticMaterialJobs:${suffix}`
    });
  },
  process: (_signal?: AbortSignal): Promise<SemanticProcessResult> =>
    Promise.resolve({
      processed: [],
      remaining: 0,
      failed: [],
      materials: { processed: [], remaining: 0, failed: [] }
    }),
  query: (_signal?: AbortSignal): Promise<SemanticQueryResult> =>
    Promise.resolve({ overlayGeneration: 1, hits: [], usage: [], diagnostics: {} }),
  read: (_signal?: AbortSignal): Promise<unknown> => Promise.resolve(undefined)
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => {
    model.requestScopes += 1;
    return Promise.resolve(model.scope);
  }
}));
vi.mock("$capabilities/semantic-overlay", () => ({
  enqueueSemanticSyncForModel: (
    explicitModel: unknown,
    projectId: string,
    ref: { kind: string; id: string },
    signal?: AbortSignal
  ) => {
    semantic.enqueued.push({ model: explicitModel, projectId, ref });
    return semantic.enqueue(ref, signal);
  },
  processSemanticSyncQueueFor: (
    _model: unknown,
    _projectId: string,
    _limit: number,
    ref?: { kind: string; id: string },
    signal?: AbortSignal
  ) => {
    semantic.requested.push(ref);
    semantic.signals.push(signal);
    return semantic.process(signal);
  },
  querySemanticOverlayForModel: (
    _model: unknown,
    _projectId: string,
    _input: unknown,
    signal?: AbortSignal
  ) => {
    semantic.querySignals.push(signal);
    return semantic.query(signal);
  },
  querySemanticMaterialsForModel: (
    _model: unknown,
    _projectId: string,
    _input: unknown,
    signal?: AbortSignal
  ) => {
    semantic.querySignals.push(signal);
    return semantic.query(signal);
  },
  readSemanticResourceForModel: (
    _model: unknown,
    _projectId: string,
    _ref: { kind: string; id: string },
    signal?: AbortSignal
  ) => {
    semantic.readSignals.push(signal);
    return semantic.read(signal);
  }
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
const { prepareOverlay } = await import("$capabilities/research-chat/api/shared/overlay");

const persona = (id: string, tools: string[], scope?: unknown): Row => ({
  ...(scope === undefined ? {} : { scope }),
  _id: `personas:${id}`,
  _creationTime: 1,
  projectId: "projects:p",
  name: `Persona ${id}`,
  definition: {
    focus: "Read the filings",
    background: "",
    approach: "Quote before you conclude",
    outputPreferences: "",
    verification: ""
  },
  tools,
  createdBy: { kind: "user", userId: "users:u" },
  revision: 1,
  updatedAt: 10
});

const chat = (id: string, extra: Partial<Row> = {}): Row => ({
  _id: `researchThreads:${id}`,
  _creationTime: 1,
  projectId: "projects:p",
  threadId: `threads:${id}`,
  title: "A chat",
  mode: { kind: "explore" },
  findingIds: [],
  createdBy: { kind: "user", userId: "users:u" },
  updatedAt: 20,
  ...extra
});

const externalText = (
  id: string,
  name = "field-notes.txt",
  relativePath = `research/${name}`
): Row => {
  const hash = "a".repeat(64);
  return {
    _id: `externalFiles:${id}`,
    _creationTime: 1,
    projectId: "projects:p",
    name,
    originalName: name,
    relativePath,
    mediaType: "text/plain",
    subkind: "text",
    storageId: `_storage:${hash}`,
    hash,
    size: 36,
    origin: { kind: "upload" },
    createdBy: { kind: "user", userId: "users:u" },
    updatedBy: { kind: "user", userId: "users:u" },
    revision: 1,
    updatedAt: 20
  };
};

beforeEach(async () => {
  await model.operationFlights?.close();
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
    threads: [{ _id: "threads:one", _creationTime: 1, projectId: "projects:p", kind: "researchThread" }],
    threadParts: [
      { _id: "threadParts:1", _creationTime: 1, projectId: "projects:p", threadId: "threads:one", part: 1, messages: [] }
    ],
    researchTurns: [],
    resourceSets: [],
    documents: [],
    presentations: [],
    spreadsheets: [],
    externalFiles: [],
    semanticSources: [],
    semanticMaterials: []
  };
  model.logged = [];
  model.observability.logger.info = (message: string, data: unknown) => {
    model.logged.push({ message, data });
  };
  model.observability.logger.warn = (message: string, data: unknown) => {
    model.logged.push({ message, data });
  };
  model.requestScopes = 0;
  semantic.enqueued = [];
  semantic.requested = [];
  semantic.signals = [];
  semantic.querySignals = [];
  semantic.readSignals = [];
  semantic.enqueue = (ref, signal) => {
    signal?.throwIfAborted();
    const suffix = ref.id.split(":").at(-1);
    return Promise.resolve({
      ref,
      revision: 1,
      jobId: `semanticSyncJobs:${suffix}`,
      materialJobId: `semanticMaterialJobs:${suffix}`
    });
  };
  model.intelligence = { completeWithTools: () => Promise.reject(new Error("not stubbed")) };
  semantic.process = () =>
    Promise.resolve({
      processed: [],
      remaining: 0,
      failed: [],
      materials: { processed: [], remaining: 0, failed: [] }
    });
  semantic.query = () =>
    Promise.resolve({ overlayGeneration: 1, hits: [], usage: [], diagnostics: {} });
  semantic.read = () => Promise.resolve(undefined);
});

test("shared preparation uses only its explicit model and project", async () => {
  model.tables.externalFiles = [externalText("background")];

  await prepareOverlay(
    model as never,
    "projects:p" as never,
    {
      kind: "resource",
      ref: { kind: "externalFile::text", id: "externalFiles:background" as never }
    }
  );

  assert.equal(model.requestScopes, 0);
  assert.equal(semantic.enqueued.length, 1);
  assert.equal(semantic.enqueued[0]?.model, model);
  assert.equal(semantic.enqueued[0]?.projectId, "projects:p");
  assert.deepEqual(semantic.enqueued[0]?.ref, {
    kind: "externalFile::text",
    id: "externalFiles:background"
  });
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
    model.tables.threads.push({
      _id: "threads:two",
      _creationTime: 2,
      projectId: "projects:p",
      kind: "researchThread"
    });
    model.tables.threadParts.push({
      _id: "threadParts:two",
      _creationTime: 2,
      projectId: "projects:p",
      threadId: "threads:two",
      part: 1,
      messages: []
    });
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

  test("refuses reads when a current conversation part claims the thread from another project", async () => {
    model.tables.threadParts[0].projectId = "projects:other";
    const before = structuredClone(model.tables);

    await assert.rejects(
      () => readThread({ threadId: "researchThreads:one" }),
      /exact current aggregate/
    );
    await assert.rejects(() => readThreads(), /exact current aggregate/);
    assert.deepEqual(model.tables, before);
  });

  test("lists duplicate External filenames by exact current path and identity", async () => {
    model.tables.externalFiles = [
      externalText("north-evidence", "inspection.md", "evidence/North/inspection.md"),
      externalText("south-evidence", "inspection.md", "evidence/South/inspection.md")
    ];
    const result = await readThreads();
    assert.deepEqual(result.resources, [
      {
        kind: "externalFile::text",
        id: "externalFiles:north-evidence",
        name: "inspection.md",
        relativePath: "evidence/North/inspection.md"
      },
      {
        kind: "externalFile::text",
        id: "externalFiles:south-evidence",
        name: "inspection.md",
        relativePath: "evidence/South/inspection.md"
      }
    ]);

    model.tables.externalFiles[0] = {
      ...model.tables.externalFiles[0],
      legacyKind: "text"
    };
    await assert.rejects(() => readThreads(), /unknown field: legacyKind/);
  });

  test("a chat in another project is absent rather than refused", async () => {
    model.tables.researchThreads.push(chat("elsewhere", { projectId: "projects:other" }));
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
  test("re-resolves the append aggregate inside its transaction and rolls back a changed claimant", async () => {
    const before = structuredClone(model.tables);
    const transaction = model.store.transaction;
    let injected = false;
    model.store.transaction = ((work: (unit: unknown) => unknown): unknown =>
      transaction((unit) => {
        if (!injected) {
          injected = true;
          model.tables.threadParts[0].projectId = "projects:other";
        }
        return work(unit);
      })) as typeof model.store.transaction;

    try {
      await assert.rejects(
        () => ask({ threadId: "researchThreads:one", text: "Do not append this" }),
        /exact current aggregate/
      );
    } finally {
      model.store.transaction = transaction;
    }

    assert.equal(injected, true);
    assert.deepEqual(model.tables, before);
  });

  test("invalid deadline configuration cannot strand a running turn or flight", async () => {
    const configured = model.configuration.get;
    model.configuration.get = (key: string) =>
      key === "intelligence.chat.deadlineMs" ? 999 : configured(key);
    try {
      await assert.rejects(
        ask({ threadId: "researchThreads:one", text: "Will this start?" }),
        /deadlineMs/
      );
      assert.deepEqual(model.tables.researchTurns, []);
      await model.operationFlights.close();
    } finally {
      model.configuration.get = configured;
    }
  });

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

  test("an observability failure after publication cannot rewrite the answer as failed", async () => {
    answers({ status: "answered", sources: [], response: "Authoritative.", findings: [] });
    model.observability.logger.info = () => {
      throw new Error("logger unavailable");
    };

    const result = await ask({ threadId: "researchThreads:one", text: "What is current?" });

    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "answered");
    assert.equal(Object.hasOwn(model.tables.researchTurns[0], "error"), false);
    assert.equal((model.tables.threadParts[0].messages as unknown[]).length, 2);
  });

  test("two concurrent asks can open only one running turn and one prompt", async () => {
    let entered!: () => void;
    const providerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let finish!: () => void;
    const mayFinish = new Promise<void>((resolve) => {
      finish = resolve;
    });
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        entered();
        await mayFinish;
        const submit = input.tools.find((tool) => tool.name === "submit_answer");
        await submit!.execute({
          status: "answered",
          sources: [],
          response: "One answer.",
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

    const first = ask({ threadId: "researchThreads:one", text: "First?" });
    await providerEntered;
    const second = await ask({ threadId: "researchThreads:one", text: "Second?" });

    assert.equal(second.accepted, false);
    assert.equal(second.accepted ? "" : second.reason, "invalid-state");
    assert.equal(model.tables.researchTurns.length, 1);
    assert.equal((model.tables.threadParts[0].messages as unknown[]).length, 1);

    finish();
    await first;
    assert.equal(model.tables.researchTurns.length, 1);
    assert.equal((model.tables.threadParts[0].messages as unknown[]).length, 2);
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

  test("refuses a chat whose persisted persona is missing required current fields", async () => {
    const malformed = persona("malformed", []);
    delete malformed.tools;
    model.tables.personas.push(malformed);
    model.tables.researchThreads = [chat("one", { personaId: "personas:malformed" })];

    await assert.rejects(
      () => ask({ threadId: "researchThreads:one", text: "Hello" }),
      /missing required field: tools/
    );
    assert.deepEqual(model.tables.researchTurns, []);
  });

  test("a stranded running turn is reclaimed rather than blocking the chat forever", async () => {
    model.tables.researchTurns = [
      {
        _id: "researchTurns:stranded",
        _creationTime: 1,
        projectId: "projects:p",
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
    assert.equal(Object.hasOwn(model.tables.researchTurns[0], "messageId"), false);
    assert.equal(Object.hasOwn(model.tables.researchTurns[0], "usage"), false);
    assert.equal(Object.hasOwn(model.tables.researchTurns[0], "model"), false);
    assert.equal(Object.hasOwn(model.tables.researchTurns[0], "answeredAt"), false);
    assert.deepEqual(model.tables.researchTurns[0].blocks, []);
  });

  test("server close interrupts semantic preparation and waits for its terminal turn write", async () => {
    model.tables.documents.push({
      _id: "documents:slow",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Slow document",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    let entered!: () => void;
    const preparing = new Promise<void>((resolve) => {
      entered = resolve;
    });
    semantic.process = async (signal) => {
      assert.notEqual(signal, undefined);
      entered();
      await new Promise<never>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
      throw new Error("unreachable");
    };

    const pending = ask({ threadId: "researchThreads:one", text: "Read the slow document" });
    await preparing;
    const closing = model.operationFlights.close();

    const [result] = await Promise.all([pending, closing]);

    assert.equal(result.accepted, true);
    assert.equal(semantic.signals[0]?.aborted, true);
    assert.equal(model.tables.researchTurns[0].state, "cancelled");
    assert.match(String(model.tables.researchTurns[0].error), /Cancelled/);
  });

  test("server close interrupts an embedding blocked inside a retrieval tool", async () => {
    let entered!: () => void;
    const retrieving = new Promise<void>((resolve) => {
      entered = resolve;
    });
    semantic.query = async (signal) => {
      assert.notEqual(signal, undefined);
      entered();
      await new Promise<never>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
      throw new Error("unreachable");
    };
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        const retrieve = input.tools.find((tool) => tool.name === "retrieve");
        assert.notEqual(retrieve, undefined);
        await retrieve!.execute({ query: "blocked retrieval" });
        throw new Error("unreachable");
      }
    } as never;

    const pending = ask({ threadId: "researchThreads:one", text: "Search the project" });
    await retrieving;
    const closing = model.operationFlights.close();

    const [result] = await Promise.all([pending, closing]);

    assert.equal(result.accepted, true);
    assert.equal(semantic.querySignals[0]?.aborted, true);
    assert.equal(model.tables.researchTurns[0].state, "cancelled");
  });

  test("server close interrupts a native read blocked inside a reading tool", async () => {
    model.tables.documents.push({
      _id: "documents:slow-read",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Slow read",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    let entered!: () => void;
    const reading = new Promise<void>((resolve) => {
      entered = resolve;
    });
    semantic.read = async (signal) => {
      assert.notEqual(signal, undefined);
      entered();
      await new Promise<never>((_resolve, reject) => {
        signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
      });
      throw new Error("unreachable");
    };
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        const read = input.tools.find((tool) => tool.name === "read_text");
        assert.notEqual(read, undefined);
        await read!.execute({
          kind: "document",
          id: "documents:slow-read",
          from: 0,
          to: 1
        });
        throw new Error("unreachable");
      }
    } as never;

    const pending = ask({ threadId: "researchThreads:one", text: "Read the document" });
    await reading;
    const closing = model.operationFlights.close();

    const [result] = await Promise.all([pending, closing]);

    assert.equal(result.accepted, true);
    assert.equal(semantic.readSignals[0]?.aborted, true);
    assert.equal(model.tables.researchTurns[0].state, "cancelled");
  });

  test("a resource that cannot be indexed does not prevent an unrelated question from finishing", async () => {
    model.tables.presentations.push({
      _id: "presentations:broken",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Broken presentation",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    semantic.process = () =>
      Promise.resolve({
        processed: [],
        remaining: 0,
        failed: [
          {
            jobId: "semanticSyncJobs:broken",
            ref: { kind: "presentation", id: "presentations:broken" },
            error: "The presentation cannot be projected"
          }
        ],
        materials: {
          processed: [],
          remaining: 0,
          failed: [
            {
              jobId: "semanticMaterialJobs:broken",
              ref: { kind: "presentation", id: "presentations:broken" },
              error: "The presentation cannot be projected"
            }
          ]
        }
      });
    answers({ status: "insufficient", sources: [], response: "", findings: [] });

    const result = await ask({
      threadId: "researchThreads:one",
      text: "If five apples lose two, how many remain?"
    });

    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "insufficient");
    assert.match(
      String((model.tables.researchTurns[0].blocks as { display: string }[])[0].display),
      /Nothing in this project answers that/
    );
    const warning = model.logged.find((entry) => entry.message === "researchChat.overlayIncomplete");
    assert.notEqual(warning, undefined);
    assert.deepEqual(warning?.data, {
      projectId: "projects:p",
      failures: [
        {
          lane: "text",
          ref: { kind: "presentation", id: "presentations:broken" },
          error: "The presentation cannot be projected"
        },
        {
          lane: "material",
          ref: { kind: "presentation", id: "presentations:broken" },
          error: "The presentation cannot be projected"
        }
      ]
    });
  });

  test("a resource-scoped question fails when its selected resource cannot be indexed", async () => {
    model.tables.presentations.push({
      _id: "presentations:broken",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Broken presentation",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    semantic.process = () =>
      Promise.resolve({
        processed: [],
        remaining: 0,
        failed: [
          {
            jobId: "semanticSyncJobs:broken",
            ref: { kind: "presentation", id: "presentations:broken" },
            error: "The presentation cannot be projected"
          }
        ],
        materials: { processed: [], remaining: 0, failed: [] }
      });

    const result = await ask({
      threadId: "researchThreads:one",
      text: "What does this presentation say?",
      scope: {
        kind: "resource",
        ref: { kind: "presentation", id: "presentations:broken" }
      }
    });

    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "failed");
    assert.match(
      String(model.tables.researchTurns[0].error),
      /selected resource could not be prepared.*presentation cannot be projected/i
    );
    assert.deepEqual(semantic.requested, [
      { kind: "presentation", id: "presentations:broken" }
    ]);
  });

  test("a historical failed job cannot reject a resource whose lanes are already current", async () => {
    model.tables.presentations.push({
      _id: "presentations:current",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Current presentation",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    semantic.enqueue = (ref) => Promise.resolve({ ref, revision: 2 });
    semantic.process = () =>
      Promise.resolve({
        processed: [],
        remaining: 0,
        failed: [
          {
            jobId: "semanticSyncJobs:historical",
            ref: { kind: "presentation", id: "presentations:current" },
            error: "An obsolete job failed"
          }
        ],
        materials: {
          processed: [],
          remaining: 0,
          failed: [
            {
              jobId: "semanticMaterialJobs:historical",
              ref: { kind: "presentation", id: "presentations:current" },
              error: "An obsolete material job failed"
            }
          ]
        }
      });
    answers({ status: "answered", sources: [], response: "Current.", findings: [] });

    const result = await ask({
      threadId: "researchThreads:one",
      text: "What does this current presentation say?",
      scope: {
        kind: "resource",
        ref: { kind: "presentation", id: "presentations:current" }
      }
    });

    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "answered");
    assert.equal(
      model.logged.some((entry) => entry.message === "researchChat.overlayIncomplete"),
      false
    );
  });

  test("a failure from an earlier batch does not survive a settled successful revision", async () => {
    model.tables.presentations.push({
      _id: "presentations:recovered",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Recovered presentation",
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    let batch = 0;
    semantic.process = () => {
      batch += 1;
      return Promise.resolve(
        batch === 1
          ? {
              processed: [],
              remaining: 1,
              failed: [
                {
                  jobId: "semanticSyncJobs:recovered",
                  ref: { kind: "presentation", id: "presentations:recovered" },
                  error: "An older revision failed"
                }
              ],
              materials: { processed: [], remaining: 0, failed: [] }
            }
          : {
              processed: [],
              remaining: 0,
              failed: [],
              materials: { processed: [], remaining: 0, failed: [] }
            }
      );
    };
    answers({ status: "answered", sources: [], response: "Recovered.", findings: [] });

    const result = await ask({
      threadId: "researchThreads:one",
      text: "What does the recovered presentation say?",
      scope: {
        kind: "resource",
        ref: { kind: "presentation", id: "presentations:recovered" }
      }
    });

    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "answered");
    assert.equal(batch, 2);
  });

  test("a queue that does not settle inside the bounded drain fails the turn", async () => {
    let batches = 0;
    semantic.process = () => {
      batches += 1;
      return Promise.resolve({
        processed: [],
        remaining: 1,
        failed: [],
        materials: { processed: [], remaining: 0, failed: [] }
      });
    };

    const result = await ask({ threadId: "researchThreads:one", text: "Anything?" });

    assert.equal(result.accepted, true);
    assert.equal(batches, 20);
    assert.equal(model.tables.researchTurns[0].state, "failed");
    assert.match(String(model.tables.researchTurns[0].error), /did not settle/);
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
      {
        _id: "documents:1", _creationTime: 1, projectId: "projects:p", title: "In scope",
        createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
      },
      {
        _id: "documents:2", _creationTime: 1, projectId: "projects:p", title: "Out of scope",
        createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
      }
    ];

    await ask({ threadId: "researchThreads:one", text: "Anything" });
    assert.deepEqual(reachable, ["documents:1", "refused the excluded document"]);
  });

  test("does not retain a reusable set after that row becomes bound private state", async () => {
    model.tables.personas.push(persona("set", ["retrieve", "resource.read"], {
      include: [{ select: "set", setId: "resourceSets:held" }],
      exclude: []
    }));
    model.tables.researchThreads = [chat("one", { personaId: "personas:set" })];
    model.tables.documents = [
      {
        _id: "documents:private", _creationTime: 1, projectId: "projects:p", title: "Private input",
        createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
      }
    ];
    model.tables.resourceSets = [{
      _id: "resourceSets:held",
      _creationTime: 1,
      projectId: "projects:p",
      name: "Reusable while named",
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:private" }] }],
        exclude: []
      },
      createdBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    }];
    const listOutcomes: Array<string[] | string> = [];
    const readFailures: string[] = [];
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        const list = input.tools.find((tool) => tool.name === "list_resources");
        try {
          const seen = (await list!.execute({})) as { resources: { id: string }[] };
          listOutcomes.push(seen.resources.map((row) => row.id));
        } catch (error) {
          listOutcomes.push(error instanceof Error ? error.message : String(error));
        }
        const read = input.tools.find((tool) => tool.name === "read_text");
        try {
          await read!.execute({
            kind: "document",
            id: "documents:private",
            from: 0,
            to: 1
          });
        } catch (error) {
          readFailures.push(error instanceof Error ? error.message : String(error));
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

    const first = await ask({ threadId: "researchThreads:one", text: "While reusable" });
    assert.equal(first.accepted, true);
    const privateRow: Row = {
      ...model.tables.resourceSets[0],
      boundTo: { kind: "hole", templateId: "templates:one", hole: "sources" }
    };
    delete privateRow.name;
    model.tables.resourceSets[0] = privateRow;
    const second = await ask({ threadId: "researchThreads:one", text: "After becoming private" });
    assert.equal(second.accepted, true);
    assert.equal(model.tables.researchTurns.at(-1)?.state, "answered");

    const reusable: Row = {
      ...model.tables.resourceSets[0],
      name: "Reusable while named"
    };
    delete reusable.boundTo;
    model.tables.resourceSets = [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Duplicate claimant" }
    ];
    const duplicate = await ask({ threadId: "researchThreads:one", text: "After duplicate corruption" });
    assert.equal(duplicate.accepted, true);

    model.tables.resourceSets = [
      { ...reusable, set: { include: "everything", exclude: [] } }
    ];
    const malformed = await ask({ threadId: "researchThreads:one", text: "After shape corruption" });
    assert.equal(malformed.accepted, true);

    assert.deepEqual(listOutcomes[0], ["documents:private"]);
    assert.match(String(listOutcomes[1]), /resource set 'resourceSets:held' does not exist/);
    assert.match(readFailures[0], /no readable text/);
    assert.match(readFailures[1], /resource set 'resourceSets:held' does not exist/);
    assert.equal(model.tables.researchTurns.at(-2)?.state, "failed");
    assert.match(String(model.tables.researchTurns.at(-2)?.error), /repeats row id/);
    assert.equal(model.tables.researchTurns.at(-1)?.state, "failed");
    assert.match(String(model.tables.researchTurns.at(-1)?.error), /non-current field values/);
  });
});

describe("the turn's own scope", () => {
  test("a missing selected resource fails before provider work", async () => {
    const result = await ask({
      threadId: "researchThreads:one",
      text: "Read this missing file",
      scope: { kind: "resource", ref: { kind: "document", id: "documents:missing" } }
    });

    assert.equal(result.accepted, true);
    assert.equal(model.tables.researchTurns[0].state, "failed");
    assert.match(String(model.tables.researchTurns[0].error), /does not exist in this project/i);
    assert.deepEqual(semantic.requested, []);
  });

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
      {
        _id: "documents:1", _creationTime: 1, projectId: "projects:p", title: "Chosen",
        createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
      },
      {
        _id: "documents:2", _creationTime: 1, projectId: "projects:p", title: "Not chosen",
        createdBy: { kind: "system" }, updatedBy: { kind: "system" }, updatedAt: 1
      }
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

  test("an uploaded text file keeps its exact identity through preparation, listing, and reading", async () => {
    model.tables.externalFiles = [externalText("field-notes")];
    const seen: Array<Record<string, unknown>> = [];
    semantic.read = () => Promise.resolve({
      ref: { kind: "externalFile::text", id: "externalFiles:field-notes" },
      revision: 1,
      contentHash: "a".repeat(64),
      text: "Five apples minus two leaves three.",
      encoding: "utf-16",
      locators: [],
      hardBoundaries: []
    });
    model.intelligence = {
      completeWithTools: async (input: {
        tools: readonly { name: string; execute: (value: unknown) => Promise<unknown> }[];
      }) => {
        const tool = (name: string) => {
          const found = input.tools.find((candidate) => candidate.name === name);
          if (found === undefined) {
            throw new Error(`missing ${name} from ${input.tools.map((candidate) => candidate.name).join(",")}`);
          }
          return found;
        };
        const list = tool("list_resources");
        const read = tool("read_text");
        seen.push(await list.execute({}) as Record<string, unknown>);
        const readResult = await read.execute({
          kind: "externalFile::text",
          id: "externalFiles:field-notes",
          from: 0,
          to: 34
        }) as Record<string, unknown>;
        seen.push(readResult);
        const submit = tool("submit_answer");
        await submit.execute({
          status: "answered",
          sources: [{ sourceId: readResult.sourceId, use: "Counts the remaining apples" }],
          response: "Three apples remain.",
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

    const result = await ask({
      threadId: "researchThreads:one",
      text: "How many apples remain?",
      scope: {
        kind: "resource",
        ref: { kind: "externalFile::text", id: "externalFiles:field-notes" }
      }
    });

    assert.equal(result.accepted, true);
    assert.equal(
      model.tables.researchTurns[0].state,
      "answered",
      String(model.tables.researchTurns[0].error ?? "")
    );
    assert.deepEqual(semantic.requested[0], {
      kind: "externalFile::text",
      id: "externalFiles:field-notes"
    });
    assert.deepEqual(seen[0], {
      resources: [{
        kind: "externalFile::text",
        id: "externalFiles:field-notes",
        name: "field-notes.txt"
      }]
    });
    assert.equal(seen[1].resource, "field-notes.txt");
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
  test("refuses a cross-project part claimant without deleting any row", async () => {
    model.tables.threadParts[0].projectId = "projects:other";
    const before = structuredClone(model.tables);

    const result = await removeThread({ threadId: "researchThreads:one" });

    assert.equal(result.accepted, false);
    assert.match(result.accepted ? "" : result.detail, /wholly owned by this project/);
    assert.deepEqual(model.tables, before);
  });

  test("rolls the entire deletion back when storage fails after a constituent is removed", async () => {
    const before = structuredClone(model.tables);
    const removeRows = model.store.removeRows;
    let calls = 0;
    model.store.removeRows = ((table: string, ids: readonly string[]): void => {
      removeRows(table, ids);
      calls += 1;
      if (calls === 2) throw new Error("delete fault");
    }) as typeof model.store.removeRows;

    try {
      await assert.rejects(
        () => removeThread({ threadId: "researchThreads:one" }),
        /delete fault/
      );
    } finally {
      model.store.removeRows = removeRows;
    }

    assert.equal(calls, 2);
    assert.deepEqual(model.tables, before);
  });

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
