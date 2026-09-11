import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createOperationFlights } from "$model/server/operation-flights/index.server";
import { defineStore, type StoreModel } from "$model/server/store/index.server";
import type { ServerModel } from "$runtime/server/start.server";
import { textMessage } from "$representation/data/behavior/agents/messages";
import type { ResourceRef } from "$representation/data/types/core/resource";
import type { Id } from "$representation/data/types/core/id";

const controls = vi.hoisted(() => ({
  resources: [] as { ref: ResourceRef; name: string }[],
  prepared: [] as ResourceRef[],
  answerInputs: [] as Record<string, unknown>[],
  mode: "answer" as "answer" | "failure" | "gate" | "pause",
  entered: undefined as (() => void) | undefined,
  release: undefined as (() => void) | undefined
}));

const runtime = vi.hoisted(() => ({
  model: undefined as unknown,
  scope: { projectId: "", userId: "", username: "Uma" }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => runtime.scope
}));

vi.mock("$capabilities/research-chat", () => ({
  researchResources: () => controls.resources,
  prepareOverlay: async (
    _model: unknown,
    _projectId: unknown,
    scope: { kind: string; ref?: ResourceRef },
    signal?: AbortSignal
  ) => {
    signal?.throwIfAborted();
    if (scope.kind !== "resource" || scope.ref === undefined) {
      throw new Error("runner prepared a wider scope");
    }
    controls.prepared.push(scope.ref);
    return { indexed: 1 };
  },
  personaPrompt: (persona: { name: string }) => `\nPersona: ${persona.name}`,
  answerQuestion: async (input: Record<string, unknown> & { signal?: AbortSignal }) => {
    controls.answerInputs.push(input);
    controls.entered?.();
    if (controls.mode === "failure") throw new Error("apiKey=do-not-persist provider failed");
    if (controls.mode === "gate") {
      await new Promise<void>((_resolve, reject) => {
        input.signal?.addEventListener("abort", () => reject(input.signal?.reason), { once: true });
      });
    }
    if (controls.mode === "pause") {
      await new Promise<void>((resolve, reject) => {
        controls.release = resolve;
        input.signal?.addEventListener("abort", () => reject(input.signal?.reason), { once: true });
      });
    }
    const source = controls.resources[0];
    if (source === undefined) throw new Error("test has no source");
    return {
      status: "answered",
      blocks: [{
        id: "answer-block",
        type: "text",
        variant: "paragraph",
        atoms: [{ id: "answer-atom", kind: "literal", text: "The reserve is 731 MW." }],
        display: "The reserve is 731 MW.",
        marks: []
      }],
      sources: [{
        id: "s1",
        ref: source.ref,
        title: source.name,
        locator: "characters 0 to 29",
        excerpt: "Remaining transfer capability is 731 MW.",
        uses: ["Establishes the remaining reserve."]
      }],
      findings: [],
      queries: ["remaining transfer capability"],
      returned: [1],
      said: "answered",
      offered: 1,
      repaired: false,
      usage: { requests: 1, promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: "test/model"
    };
  }
}));

const { dispatchAgentTask } = await import(
  "$capabilities/agents/api/shared/dispatch-agent-task"
);
const { executeAgentTask } = await import(
  "$capabilities/agents/api/shared/execute-agent-task"
);
const { resumeAgentTasks } = await import(
  "$capabilities/agents/api/shared/resume-agent-tasks"
);
const { queuedRunnerPlan } = await import(
  "$capabilities/agents/api/shared/runner-plan"
);
const { effectiveTaskScope } = await import(
  "$capabilities/agents/api/shared/runner-scope"
);
const { validateCreateTask } = await import(
  "$capabilities/agents/api/create-task/validate-create-task"
);
const { updateTask } = await import(
  "$capabilities/agents/api/update-task/update-task"
);

const openModels: ServerModel[] = [];

afterEach(async () => {
  await Promise.all(openModels.splice(0).map(async (model) => await model.operationFlights.close()));
});

beforeEach(() => {
  controls.resources = [];
  controls.prepared = [];
  controls.answerInputs = [];
  controls.mode = "answer";
  controls.entered = undefined;
  controls.release = undefined;
  runtime.model = undefined;
  runtime.scope = { projectId: "", userId: "", username: "Uma" };
});

const modelWith = (store: StoreModel): ServerModel => {
  const operationFlights = createOperationFlights();
  const model = {
    store,
    operationFlights,
    configuration: {
      get: (key: string): unknown => ({
        "intelligence.task.model": "test/model",
        "intelligence.task.topK": 8,
        "intelligence.task.maxSources": 12,
        "intelligence.task.maxToolRounds": 8,
        "intelligence.task.deadlineMs": 60_000
      })[key]
    },
    observability: {
      logger: { info: () => {}, warn: () => {}, error: () => {} },
      close: async () => {}
    },
    intelligence: {},
    embedding: {},
    externalFileStorage: {},
    close: async () => await operationFlights.close()
  } as unknown as ServerModel;
  runtime.model = model;
  openModels.push(model);
  return model;
};

const tableRows = (store: StoreModel, table: string): Record<string, unknown>[] => {
  const held = store.read(table);
  return held?.kind === "table"
    ? held.rows.map((row) => row as unknown as Record<string, unknown>)
    : [];
};

const fixture = (store = defineStore({ now: () => 1_000 })) => {
  const projectId = store.create("projects", {
    name: "Grid programme",
    revision: 1,
    settings: "{}",
    updatedAt: 1_000
  });
  const userId = store.create("users", {
    authSubject: "test:uma",
    displayName: "Uma",
    settings: "{}",
    updatedAt: 1_000
  });
  const hash = "a".repeat(64);
  const externalFileId = store.create("externalFiles", {
    projectId,
    name: "transfer-reserve.md",
    originalName: "transfer-reserve.md",
    relativePath: "evidence/transfer-reserve.md",
    mediaType: "text/markdown",
    subkind: "text",
    storageId: `_storage:${hash}`,
    hash,
    size: 44,
    origin: { kind: "upload" },
    createdBy: { kind: "user", userId },
    updatedBy: { kind: "user", userId },
    revision: 1,
    updatedAt: 1_000
  });
  const otherHash = "b".repeat(64);
  const otherFileId = store.create("externalFiles", {
    projectId,
    name: "unrelated.md",
    originalName: "unrelated.md",
    relativePath: "evidence/unrelated.md",
    mediaType: "text/markdown",
    subkind: "text",
    storageId: `_storage:${otherHash}`,
    hash: otherHash,
    size: 20,
    origin: { kind: "upload" },
    createdBy: { kind: "user", userId },
    updatedBy: { kind: "user", userId },
    revision: 1,
    updatedAt: 1_000
  });
  const selected = {
    kind: "externalFile::text" as const,
    id: externalFileId
  };
  const other = {
    kind: "externalFile::text" as const,
    id: otherFileId
  };
  const personaId = store.create("personas", {
    projectId,
    name: "Grid analyst",
    definition: {
      focus: "Answer from the permitted evidence.",
      background: "",
      approach: "Check the exact number.",
      outputPreferences: "Lead with the answer.",
      verification: "Cite the source."
    },
    scope: { include: [{ select: "resources", refs: [selected] }], exclude: [] },
    tools: ["retrieve", "resource.read"],
    createdBy: { kind: "user", userId },
    revision: 1,
    updatedAt: 1_000
  });
  const threadId = store.create("threads", { projectId, kind: "agentTask" });
  const prompt = textMessage(
    "prompt-1",
    "prompt",
    { kind: "user", userId },
    1_000,
    "How much transfer capability remains?"
  );
  store.create("threadParts", { projectId, threadId, part: 1, messages: [prompt] });
  const taskId = store.create("agentTasks", {
    projectId,
    threadId,
    title: "Check transfer reserve",
    instruction: "How much transfer capability remains?",
    personaId,
    origin: { kind: "person" },
    state: "running",
    execution: { kind: "grounded" },
    tools: ["retrieve", "resource.read"],
    plan: queuedRunnerPlan(),
    outputs: [],
    questions: [],
    createdBy: { kind: "user", userId },
    startedAt: 1_000,
    revision: 1,
    updatedAt: 1_000
  });
  controls.resources = [
    { ref: selected, name: "transfer-reserve.md" },
    { ref: other, name: "unrelated.md" }
  ];
  runtime.scope = { projectId, userId, username: "Uma" };
  return { store, projectId, userId, taskId, selected, other };
};

const currentCreateTaskInput = (ref: unknown): Record<string, unknown> => ({
  personaId: "personas:current",
  title: "Read imported evidence",
  instruction: "Answer from the selected file.",
  scope: {
    include: [{ select: "resources", refs: [ref] }],
    exclude: []
  },
  tools: ["retrieve", "resource.read"]
});

describe("grounded Agent task runner", () => {
  test("answers from one exact External scope and publishes its whole result", async () => {
    const { store, taskId, selected } = fixture();
    const model = modelWith(store);

    await dispatchAgentTask(model, taskId).promise;

    expect(controls.prepared).toEqual([selected]);
    expect(controls.answerInputs).toHaveLength(1);
    expect(controls.answerInputs[0]?.bound).toEqual({
      include: [{ select: "resources", refs: [selected] }],
      exclude: []
    });
    expect(controls.answerInputs[0]?.scope).toEqual({ kind: "project" });
    expect(controls.answerInputs[0]?.grants).toEqual(["retrieve", "resource.read"]);
    const task = tableRows(store, "agentTasks")[0];
    expect(task).toMatchObject({ state: "review", finishedAt: expect.any(Number) });
    expect(Object.hasOwn(task, "execution")).toBe(false);
    expect(task.plan).toMatchObject([
      { id: "ground-scope", state: "done" },
      { id: "ground-answer", state: "done" },
      { id: "ground-publish", state: "done", note: "1 source cited" }
    ]);
    expect(task.outputs).toMatchObject([
      { title: "Grounded answer", detail: "The reserve is 731 MW." },
      { title: "transfer-reserve.md", ref: selected }
    ]);
    const messages = tableRows(store, "threadParts")[0]?.messages as Record<string, unknown>[];
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({
      role: "response",
      author: { kind: "agent", taskId },
      attachments: [selected],
      state: "complete"
    });
    expect(tableRows(store, "activity")).toMatchObject([
      {
        actor: { kind: "agent", taskId },
        event: { kind: "agents.task-completed", outcome: "answered", sourceCount: 1 }
      }
    ]);
  });

  test("a task's exact scope overrides rather than widens its persona scope", async () => {
    const { store, taskId, selected, other } = fixture();
    const task = tableRows(store, "agentTasks")[0];
    const { _id: _rowId, _creationTime: _createdAt, ...taskFields } = task;
    store.update(`agentTasks.${taskId}`, {
      ...taskFields,
      scope: { include: [{ select: "resources", refs: [other] }], exclude: [] }
    });
    controls.resources = [
      { ref: other, name: "unrelated.md" },
      { ref: selected, name: "transfer-reserve.md" }
    ];
    const model = modelWith(store);

    await dispatchAgentTask(model, taskId).promise;

    expect(controls.prepared).toEqual([other]);
    expect(controls.answerInputs[0]?.bound).toEqual({
      include: [{ select: "resources", refs: [other] }],
      exclude: []
    });
    expect(JSON.stringify(tableRows(store, "agentTasks")[0]?.outputs)).toContain(other.id);
    expect(JSON.stringify(tableRows(store, "agentTasks")[0]?.outputs)).not.toContain(selected.id);
  });

  test("both absent current scopes mean read nothing rather than project-wide access", async () => {
    expect(effectiveTaskScope({}, {})).toEqual({
      include: [{ select: "resources", refs: [] }],
      exclude: []
    });
    const { store, taskId } = fixture();
    const persona = tableRows(store, "personas")[0];
    const { _id: personaId, _creationTime: _createdAt, scope: _scope, ...personaFields } = persona;
    store.update(`personas.${personaId}`, { ...personaFields, revision: 2 });
    const model = modelWith(store);

    await dispatchAgentTask(model, taskId).promise;

    expect(controls.prepared).toEqual([]);
    expect(controls.answerInputs[0]?.bound).toEqual({
      include: [{ select: "resources", refs: [] }],
      exclude: []
    });
    expect(tableRows(store, "agentTasks")[0]).toMatchObject({ state: "finished" });
  });

  test("discards an in-flight answer when the inherited persona scope changes", async () => {
    const { store, taskId, other } = fixture();
    const model = modelWith(store);
    controls.mode = "pause";
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    controls.entered = entered;

    const flight = dispatchAgentTask(model, taskId);
    await started;
    const persona = tableRows(store, "personas")[0];
    const { _id: personaId, _creationTime: _createdAt, ...personaFields } = persona;
    store.update(`personas.${personaId}`, {
      ...personaFields,
      scope: { include: [{ select: "resources", refs: [other] }], exclude: [] },
      revision: 2,
      updatedAt: 2_000
    });
    controls.resources = [{ ref: other, name: "unrelated.md" }];
    controls.mode = "answer";
    controls.release?.();
    await flight.promise;

    expect(controls.answerInputs).toHaveLength(2);
    expect(controls.answerInputs[0]?.bound).not.toEqual(controls.answerInputs[1]?.bound);
    expect(controls.answerInputs[1]?.bound).toEqual({
      include: [{ select: "resources", refs: [other] }],
      exclude: []
    });
    expect(JSON.stringify(tableRows(store, "agentTasks")[0]?.outputs)).toContain(other.id);
  });

  test("refuses to publish a source outside the task's exact scope", async () => {
    const { store, taskId, selected, other } = fixture();
    controls.resources = [
      { ref: other, name: "unrelated.md" },
      { ref: selected, name: "transfer-reserve.md" }
    ];
    const model = modelWith(store);

    await dispatchAgentTask(model, taskId).promise;

    const task = tableRows(store, "agentTasks")[0];
    expect(task).toMatchObject({ state: "finished" });
    expect(JSON.stringify(task.outputs)).not.toContain(other.id);
    expect(JSON.stringify(task.outputs)).toContain("outside the task's exact current scope");
  });

  test("redacts provider secrets and finishes a faulted task explicitly", async () => {
    const { store, taskId } = fixture();
    const model = modelWith(store);
    controls.mode = "failure";

    await dispatchAgentTask(model, taskId).promise;

    const task = tableRows(store, "agentTasks")[0];
    expect(task.state).toBe("finished");
    expect(Object.hasOwn(task, "execution")).toBe(false);
    expect(JSON.stringify(task)).not.toContain("do-not-persist");
    expect(JSON.stringify(task)).toContain("apiKey=[redacted]");
    expect(JSON.stringify(tableRows(store, "threadParts"))).not.toContain("do-not-persist");
  });

  test("cancels immediately and persists a terminal explanation", async () => {
    const { store, taskId } = fixture();
    const model = modelWith(store);
    controls.mode = "gate";
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    controls.entered = entered;

    const flight = dispatchAgentTask(model, taskId);
    await started;
    expect(model.operationFlights.stopAgentTask(taskId)).toBe(true);
    await flight.promise;

    const task = tableRows(store, "agentTasks")[0];
    expect(task).toMatchObject({ state: "finished", finishedAt: expect.any(Number) });
    expect(JSON.stringify(task)).toContain("Stopped before the Agent finished");
  });

  test("the Stop capability wins its race without a second cancellation response", async () => {
    const { store, taskId } = fixture();
    const model = modelWith(store);
    controls.mode = "gate";
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    controls.entered = entered;

    const flight = dispatchAgentTask(model, taskId);
    await started;
    const result = await updateTask({
      taskId,
      baseRevision: 1,
      patch: { state: "finished" }
    });
    await flight.promise;

    expect(result).toMatchObject({ accepted: true, revision: 2 });
    expect(tableRows(store, "agentTasks")[0]).toMatchObject({
      state: "finished",
      revision: 2,
      outputs: []
    });
    const messages = tableRows(store, "threadParts")[0]?.messages as Record<string, unknown>[];
    expect(messages).toHaveLength(2);
    expect(JSON.stringify(messages[1])).toContain("Stopped by Uma.");
    expect(JSON.stringify(messages)).not.toContain("Stopped before the Agent finished");
  });

  test("leaves shutdown work durable and resumes the owned plan on a new process", async () => {
    const { store, taskId } = fixture();
    const first = modelWith(store);
    controls.mode = "gate";
    let entered!: () => void;
    const started = new Promise<void>((resolve) => (entered = resolve));
    controls.entered = entered;

    dispatchAgentTask(first, taskId);
    await started;
    await first.operationFlights.close();
    expect(tableRows(store, "agentTasks")[0]).toMatchObject({ state: "running" });

    controls.mode = "answer";
    controls.entered = undefined;
    const restarted = modelWith(store);
    expect(resumeAgentTasks(restarted)).toBe(1);
    await dispatchAgentTask(restarted, taskId).promise;
    expect(tableRows(store, "agentTasks")[0]).toMatchObject({ state: "review" });
  });

  test("resumes an explicitly grounded task without inferring ownership from plan text", async () => {
    const { store, taskId } = fixture();
    const task = tableRows(store, "agentTasks")[0];
    const { _id, _creationTime: _createdAt, ...fields } = task;
    store.update(`agentTasks.${_id}`, {
      ...fields,
      plan: [{ id: "project-specific", title: "Use the approved evidence", state: "pending" }]
    });
    const model = modelWith(store);

    expect(resumeAgentTasks(model)).toBe(1);
    await dispatchAgentTask(model, taskId).promise;

    expect(tableRows(store, "agentTasks")[0]).toMatchObject({ state: "review" });
  });

  test("validates every resumable aggregate before activating any task", () => {
    const { store, projectId, userId, taskId } = fixture();
    const foreignProjectId = store.create("projects", {
      name: "Foreign project",
      revision: 1,
      settings: "{}",
      updatedAt: 1_000
    });
    const foreignPersonaId = store.create("personas", {
      projectId: foreignProjectId,
      name: "Foreign persona",
      definition: {
        focus: "",
        background: "",
        approach: "",
        outputPreferences: "",
        verification: ""
      },
      tools: [],
      createdBy: { kind: "user", userId },
      revision: 1,
      updatedAt: 1_000
    });
    const threadId = store.create("threads", { projectId, kind: "agentTask" });
    store.create("threadParts", { projectId, threadId, part: 1, messages: [] });
    store.create("agentTasks", {
      projectId,
      threadId,
      title: "Cross-project persona claimant",
      instruction: "Must not run.",
      personaId: foreignPersonaId,
      origin: { kind: "person" },
      state: "running",
      execution: { kind: "grounded" },
      tools: [],
      plan: [],
      outputs: [],
      questions: [],
      createdBy: { kind: "user", userId },
      startedAt: 1_000,
      revision: 1,
      updatedAt: 1_000
    });
    const model = modelWith(store);

    expect(() => resumeAgentTasks(model)).toThrow(/persona is not available in its project/);
    expect(model.operationFlights.isAgentTaskActive(taskId)).toBe(false);
    expect(tableRows(store, "agentTasks")[0]?.plan).toEqual(queuedRunnerPlan());
  });

  test("rejects a retired bare External resource identity at Store admission", () => {
    const { store, projectId } = fixture();
    const row = tableRows(store, "agentTasks")[0];
    const { _id: _rowId, _creationTime: _createdAt, ...fields } = row;
    expect(() => store.create("agentTasks", {
      ...fields,
      projectId,
      scope: {
        include: [{
          select: "resources",
          refs: [{ kind: "externalFile", id: "externalFiles:retired" }]
        }],
        exclude: []
      }
    })).toThrow(/agentTasks|resource|current/i);
  });

  test.each([
    ["bare External kind", { kind: "externalFile", id: "externalFiles:old" }],
    ["retired External subkind", { kind: "externalFile::pdf", id: "externalFiles:old" }],
    [
      "extra reference field",
      { kind: "externalFile::text", id: "externalFiles:current", subkind: "text" }
    ]
  ])("rejects %s at the task command boundary", (_label, ref) => {
    expect(() => validateCreateTask(currentCreateTaskInput(ref))).toThrow(
      /agents\/create-task: ref is one exact current resource reference/
    );
  });

  test("rejects missing and extra task or scope fields instead of repairing them", () => {
    const current = currentCreateTaskInput({
      kind: "externalFile::text",
      id: "externalFiles:current"
    });
    const { instruction: _instruction, ...missingInstruction } = current;
    expect(() => validateCreateTask(missingInstruction)).toThrow(/instruction is text/);
    expect(() => validateCreateTask({ ...current, legacyScope: null })).toThrow(
      /unknown field legacyScope/
    );
    expect(() => validateCreateTask({
      ...current,
      scope: {
        include: [{
          select: "resources",
          refs: [{ kind: "externalFile::text", id: "externalFiles:current" }]
        }],
        exclude: [],
        version: 1
      }
    })).toThrow(/unknown field version/);
  });

  test.each(["agentTasks", "personas"] as const)(
    "rejects an extra stored %s field instead of admitting an older row shape",
    (table) => {
      const { store } = fixture();
      const row = tableRows(store, table)[0];
      const { _id: _rowId, _creationTime: _createdAt, ...fields } = row;
      expect(() => store.create(table, { ...fields, legacyMetadata: true } as never)).toThrow(
        new RegExp(table)
      );
    }
  );

  test.each(["persona", "thread", "thread part"])(
    "refuses a cross-project %s before any answer is published",
    async (relation) => {
      const { store, taskId } = fixture();
      const foreignProjectId = store.create("projects", {
        name: "Foreign project",
        revision: 1,
        settings: "{}",
        updatedAt: 1_000
      });
      if (relation === "persona") {
        const persona = tableRows(store, "personas")[0];
        const { _id, _creationTime: _createdAt, ...fields } = persona;
        store.update(`personas.${_id}`, { ...fields, projectId: foreignProjectId });
      } else if (relation === "thread") {
        const thread = tableRows(store, "threads")[0];
        const { _id, _creationTime: _createdAt, ...fields } = thread;
        store.update(`threads.${_id}`, { ...fields, projectId: foreignProjectId });
      } else {
        const part = tableRows(store, "threadParts")[0];
        const { _id, _creationTime: _createdAt, ...fields } = part;
        store.update(`threadParts.${_id}`, { ...fields, projectId: foreignProjectId });
      }
      const model = modelWith(store);

      await expect(dispatchAgentTask(model, taskId).promise).rejects.toThrow(
        /not available in its project|exact current aggregate/
      );
      expect(controls.answerInputs).toEqual([]);
      expect(tableRows(store, "agentTasks")[0]).toMatchObject({ state: "running", outputs: [] });
      expect((tableRows(store, "threadParts")[0]?.messages as unknown[])).toHaveLength(1);
    }
  );

  test("rolls back response, outputs, review state and activity as one final intent", async () => {
    let transactions = 0;
    const store = defineStore({
      now: () => 1_000,
      failpoint: (point) => {
        if (point !== "transaction:before-journal") return;
        transactions += 1;
        if (transactions === 4) throw new Error("interrupt final publication");
      }
    });
    const { taskId } = fixture(store);
    const model = modelWith(store);

    await expect(
      executeAgentTask(model, taskId, new AbortController().signal)
    ).rejects.toThrow(/interrupt final publication/);

    const task = tableRows(store, "agentTasks")[0];
    expect(task).toMatchObject({ state: "running", outputs: [] });
    expect(tableRows(store, "activity")).toEqual([]);
    expect(tableRows(store, "threadParts")[0]?.messages).toMatchObject([
      { role: "prompt" }
    ]);
  });
});
