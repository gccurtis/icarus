import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  scope: { projectId: "projects:p", userId: "users:u", username: "Uma" },
  tables: {} as Record<string, Row[]>,
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table}`);
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
      model.calls.push(`update ${path}`);
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
      model.calls.push(`remove ${path}`);
      const [table, id] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      rows.splice(index, 1);
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

const { readAgentsLibrary } = await import(
  "$capabilities/agents/api/read-agents-library/read-agents-library"
);
const { readPersona } = await import("$capabilities/agents/api/read-persona/read-persona");
const { readTask } = await import("$capabilities/agents/api/read-task/read-task");
const { createPersona } = await import("$capabilities/agents/api/create-persona/create-persona");
const { updatePersona } = await import("$capabilities/agents/api/update-persona/update-persona");
const { removePersona } = await import("$capabilities/agents/api/remove-persona/remove-persona");
const { duplicatePersona } = await import(
  "$capabilities/agents/api/duplicate-persona/duplicate-persona"
);
const { createTask } = await import("$capabilities/agents/api/create-task/create-task");
const { updateTask } = await import("$capabilities/agents/api/update-task/update-task");
const { sendTaskMessage } = await import(
  "$capabilities/agents/api/send-task-message/send-task-message"
);
const { answerTaskQuestion } = await import(
  "$capabilities/agents/api/answer-task-question/answer-task-question"
);
const { createAutomation } = await import(
  "$capabilities/agents/api/create-automation/create-automation"
);
const { updateAutomation } = await import(
  "$capabilities/agents/api/update-automation/update-automation"
);
const { removeAutomation } = await import(
  "$capabilities/agents/api/remove-automation/remove-automation"
);
const { runAutomation } = await import("$capabilities/agents/api/run-automation/run-automation");
const { createChat } = await import("$capabilities/agents/api/create-chat/create-chat");

const user = (userId: string) => ({ kind: "user", userId });

const persona = (id: string, extra: Record<string, unknown> = {}): Row => ({
  _id: `personas:${id}`,
  _creationTime: 1,
  projectId: "projects:p",
  name: `Persona ${id}`,
  definition: { focus: "", background: "", approach: "", outputPreferences: "", verification: "" },
  scope: { include: [{ select: "project" }], exclude: [] },
  tools: ["retrieve", "resource.read"],
  createdBy: user("users:u"),
  revision: 2,
  updatedAt: 10,
  ...extra
});

const task = (id: string, extra: Record<string, unknown> = {}): Row => ({
  _id: `agentTasks:${id}`,
  _creationTime: 1,
  projectId: "projects:p",
  threadId: `threads:${id}`,
  title: `Task ${id}`,
  instruction: "Do the thing",
  personaId: "personas:a",
  origin: { kind: "person" },
  state: "running",
  tools: ["retrieve"],
  plan: [],
  outputs: [],
  questions: [],
  createdBy: user("users:u"),
  startedAt: 5,
  revision: 1,
  updatedAt: 5,
  ...extra
});

const automation = (id: string, extra: Record<string, unknown> = {}): Row => ({
  _id: `automations:${id}`,
  _creationTime: 1,
  projectId: "projects:p",
  name: `Rule ${id}`,
  personaId: "personas:a",
  instruction: "Every time, do the thing",
  trigger: { kind: "manual" },
  tools: ["retrieve"],
  enabled: true,
  firedCount: 0,
  createdBy: user("users:u"),
  revision: 3,
  updatedAt: 10,
  ...extra
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.calls.length = 0;
  model.scope = { projectId: "projects:p", userId: "users:u", username: "Uma" };
  model.tables = {
    users: [
      { _id: "users:u", _creationTime: 1, displayName: "Uma" },
      { _id: "users:v", _creationTime: 1, displayName: "Victor" }
    ],
    personas: [
      persona("a"),
      persona("b"),
      persona("elsewhere", { projectId: "projects:other" })
    ],
    agentTasks: [
      task("1"),
      task("2", {
        state: "review",
        finishedAt: 50,
        plan: [
          { id: "s1", title: "Read", state: "done" },
          { id: "s2", title: "Write", state: "done" }
        ],
        questions: [{ id: "q1", text: "Which one?", askedAt: 6 }]
      }),
      task("3", { state: "finished", finishedAt: 60, personaId: "personas:b" }),
      task("gone", { projectId: "projects:other" })
    ],
    threads: [
      { _id: "threads:1", _creationTime: 1, projectId: "projects:p", kind: "agentTask" },
      { _id: "threads:2", _creationTime: 1, projectId: "projects:p", kind: "agentTask" },
      { _id: "threads:3", _creationTime: 1, projectId: "projects:p", kind: "agentTask" }
    ],
    threadParts: [
      {
        _id: "threadParts:1",
        _creationTime: 1,
        projectId: "projects:p",
        threadId: "threads:1",
        part: 1,
        messages: [
          {
            id: "m1",
            role: "prompt",
            author: user("users:u"),
            sentAt: 5,
            blocks: [
              {
                id: "b1",
                type: "text",
                variant: "paragraph",
                atoms: [{ id: "a1", kind: "literal", text: "Do the thing" }],
                display: "Do the thing",
                marks: []
              }
            ],
            state: "complete"
          }
        ]
      }
    ],
    automations: [automation("m"), automation("fired", { firedCount: 2 })],
    researchThreads: [
      {
        _id: "researchThreads:c",
        _creationTime: 1,
        projectId: "projects:p",
        threadId: "threads:c",
        personaId: "personas:a",
        title: "A chat",
        mode: { kind: "explore" },
        findingIds: [],
        createdBy: user("users:v"),
        updatedAt: 20
      }
    ],
    documents: [{
      _id: "documents:1",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Brief"
    }],
    slideDecks: [],
    spreadsheets: [],
    findings: [],
    resourceSets: [],
    activity: [
      {
        _id: "activity:1",
        _creationTime: 30,
        projectId: "projects:p",
        actor: user("users:u"),
        actorLabel: "Uma",
        verb: "edited",
        target: { kind: "document", id: "documents:1", label: "Brief" }
      },
      {
        _id: "activity:2",
        _creationTime: 40,
        projectId: "projects:p",
        actor: { kind: "agent", taskId: "agentTasks:1" },
        actorLabel: "",
        verb: "finished",
        target: { kind: "task", id: "agentTasks:1", label: "Task 1" }
      },
      {
        _id: "activity:3",
        _creationTime: 50,
        projectId: "projects:p",
        actor: user("users:v"),
        actorLabel: "Victor",
        verb: "switched off",
        target: { kind: "automation", id: "automations:m", label: "Rule m" }
      }
    ]
  };
  model.tables.agentTasks[2] = task("3", {
    state: "finished",
    finishedAt: 60,
    personaId: "personas:b",
    origin: { kind: "automation", automationId: "automations:fired", trigger: "manual" }
  });
});

describe("reading the library", () => {
  test("projects the visible personas, tasks, automations and chats", async () => {
    const library = await readAgentsLibrary();
    assert.deepEqual(
      library.personas.map((row) => row.id),
      ["personas:a", "personas:b"]
    );
    assert.deepEqual(
      library.tasks.map((row) => row.id).toSorted(),
      ["agentTasks:1", "agentTasks:2", "agentTasks:3"]
    );
    const a = library.personas.find((row) => row.id === "personas:a");
    assert.deepEqual(a?.counts, {
      tasks: 2,
      running: 1,
      review: 1,
      finished: 0,
      automations: 2,
      chats: 1
    });
    const reviewed = library.tasks.find((row) => row.id === "agentTasks:2");
    assert.equal(reviewed?.progress.percent, 100);
    assert.equal(reviewed?.openQuestions, 1);
    const fired = library.tasks.find((row) => row.id === "agentTasks:3");
    assert.equal(fired?.automationName, "Rule fired");
    assert.equal(fired?.startedByName, "Uma");
    assert.equal(library.chats[0]?.createdByName, "Victor");
    assert.equal(library.tools.length, 6);
    assert.deepEqual(library.resources.map((row) => row.name), ["Brief"]);
    assert.deepEqual(
      library.activity.map((row) => [row.actorName, row.verb, row.subject, row.personaId]),
      [["", "finished", "Task 1", "personas:a"]]
    );
    assert.equal(fired?.startedByName, "Uma");
  });

  test("quarantines rows missing required current persona, task, or automation fields", async () => {
    model.tables.personas.push(
      persona("missing-definition", { definition: undefined }),
      persona("missing-tools", { tools: undefined }),
      persona("missing-revision", { revision: undefined })
    );
    model.tables.agentTasks.push(
      task("missing-tools", { tools: undefined }),
      task("missing-plan", { plan: undefined }),
      task("missing-origin", { origin: undefined })
    );
    model.tables.automations.push(
      automation("missing-tools", { tools: undefined }),
      automation("missing-trigger", { trigger: undefined }),
      automation("missing-count", { firedCount: undefined })
    );

    const library = await readAgentsLibrary();

    assert.equal(library.personas.some((row) => row.id.includes("missing-")), false);
    assert.equal(library.tasks.some((row) => row.id.includes("missing-")), false);
    assert.equal(library.automations.some((row) => row.id.includes("missing-")), false);
    assert.equal(await readPersona({ personaId: "personas:missing-tools" }), null);
    assert.equal(await readTask({ taskId: "agentTasks:missing-tools" }), null);
  });

  test("names what started an automation's task by its trigger", async () => {
    model.tables.automations.push(
      automation("clock", { trigger: { kind: "schedule", at: "02:00", repeats: "daily", timezone: "UTC" } })
    );
    model.tables.agentTasks.push(
      task("4", {
        origin: { kind: "automation", automationId: "automations:clock", trigger: "schedule" },
        createdBy: { kind: "system" }
      }),
      task("5", {
        origin: {
          kind: "automation",
          automationId: "automations:m",
          trigger: "resource-edited",
          ref: { kind: "document", id: "documents:1" }
        },
        createdBy: { kind: "system" }
      })
    );
    const library = await readAgentsLibrary();
    assert.equal(library.tasks.find((row) => row.id === "agentTasks:4")?.startedByName, "02:00 daily");
    assert.equal(library.tasks.find((row) => row.id === "agentTasks:5")?.startedByName, "Edit to Brief");
  });

  test("reads one task with its thread and answers null for a foreign one", async () => {
    const detail = await readTask({ taskId: "agentTasks:1" });
    assert.equal(detail?.turns.length, 1);
    assert.equal(detail?.turns[0]?.text, "Do the thing");
    assert.equal(detail?.turns[0]?.from, "person");
    assert.equal(await readTask({ taskId: "agentTasks:gone" }), null);
  });

  test("refuses an input with a stray field before touching the store", async () => {
    await assert.rejects(() => readPersona({ personaId: "personas:a", extra: 1 } as never), /unknown field/);
  });

  test("offers only admitted uniquely identified named Resource Sets", async () => {
    const reusable = (id: string, name: string, extra: Record<string, unknown> = {}): Row => ({
      _id: `resourceSets:${id}`,
      _creationTime: 1,
      projectId: "projects:p",
      name,
      set: { include: [{ select: "project" }], exclude: [] },
      createdBy: user("users:u"),
      revision: 1,
      updatedAt: 1,
      ...extra
    });
    model.tables.resourceSets = [
      reusable("duplicate", "First claimant"),
      reusable("duplicate", "Foreign claimant", { projectId: "projects:other" }),
      reusable("malformed", "Malformed", { set: { include: "everything", exclude: [] } }),
      reusable("valid", "Valid set"),
      reusable("private", "Private", {
        name: undefined,
        boundTo: { kind: "resource", resourceId: "documents:1", hole: "evidence" }
      })
    ];

    const library = await readAgentsLibrary();

    assert.deepEqual(library.resourceSets, [
      { id: "resourceSets:valid", name: "Valid set" }
    ]);
  });
});

describe("personas", () => {
  test("creates with the default tools and a project scope", async () => {
    const result = await createPersona({ name: "  New one " });
    assert.equal(result.accepted, true);
    const row = model.tables.personas.find((candidate) => candidate._id === result.id);
    assert.equal(row?.name, "New one");
    assert.deepEqual(row?.tools, ["retrieve", "resource.read"]);
    assert.deepEqual(row?.scope, { include: [{ select: "project" }], exclude: [] });
  });

  test("updates a section, the description and the tools against the right revision", async () => {
    const result = await updatePersona({
      personaId: "personas:a",
      baseRevision: 2,
      patch: {
        section: { name: "focus", text: "Only the record." },
        description: "Reads the record",
        tools: ["web.search", "retrieve"]
      }
    });
    assert.deepEqual(result, { accepted: true, id: "personas:a", revision: 3 });
    const row = model.tables.personas[0];
    assert.equal((row.definition as { focus: string }).focus, "Only the record.");
    assert.equal(row.description, "Reads the record");
    assert.deepEqual(row.tools, ["retrieve", "web.search"]);
  });

  test("refuses a stale revision and an unusable scope", async () => {
    const stale = await updatePersona({ personaId: "personas:a", baseRevision: 1, patch: { name: "X" } });
    assert.equal(stale.accepted, false);
    assert.equal(stale.accepted === false && stale.reason, "stale");
    await assert.rejects(
      () =>
        updatePersona({
          personaId: "personas:a",
          baseRevision: 2,
          patch: { scope: { include: [], exclude: [] } }
        }),
      /includes something/
    );
  });

  test("refuses to remove a persona that tasks still name, and removes a free one", async () => {
    const held = await removePersona({ personaId: "personas:a", baseRevision: 2 });
    assert.equal(held.accepted === false && held.reason, "in-use");
    const fresh = await createPersona({ name: "Free" });
    const gone = await removePersona({ personaId: fresh.id, baseRevision: 1 });
    assert.equal(gone.accepted, true);
    assert.equal(model.tables.personas.some((row) => row._id === fresh.id), false);
  });

  test("duplicates into a viewer-owned copy at revision one", async () => {
    const result = await duplicatePersona({ personaId: "personas:a" });
    assert.equal(result.accepted, true);
    const copy = model.tables.personas.find((row) => row._id === result.id);
    assert.equal(copy?.name, "Persona a (copy)");
    assert.equal(copy?.revision, 1);
  });
});

describe("tasks", () => {
  test("creates a running task with a thread that opens on the instruction", async () => {
    const result = await createTask({
      personaId: "personas:a",
      title: "Check it",
      instruction: "Check every number.",
      tools: ["retrieve", "web.search"]
    });
    assert.equal(result.accepted, true);
    const row = model.tables.agentTasks.find((candidate) => candidate._id === result.id);
    assert.equal(row?.state, "running");
    assert.deepEqual(row?.tools, ["retrieve", "web.search"]);
    const part = model.tables.threadParts.find((candidate) => candidate.threadId === row?.threadId);
    assert.equal((part?.messages as unknown[]).length, 1);
  });

  test("stops a running task and refuses a second finish", async () => {
    const stopped = await updateTask({ taskId: "agentTasks:1", baseRevision: 1, patch: { state: "finished" } });
    assert.equal(stopped.accepted, true);
    assert.equal(model.tables.agentTasks[0].state, "finished");
    assert.equal(model.tables.agentTasks[0].finishedAt, 500);
    const again = await updateTask({ taskId: "agentTasks:1", baseRevision: 2, patch: { state: "finished" } });
    assert.equal(again.accepted === false && again.reason, "invalid-state");
  });

  test("refuses to change an instruction the agent has started on", async () => {
    const result = await updateTask({
      taskId: "agentTasks:2",
      baseRevision: 1,
      patch: { instruction: "Something else" }
    });
    assert.equal(result.accepted === false && result.reason, "invalid-state");
  });

  test("appends a message to the thread and refuses one to a finished task", async () => {
    const sent = await sendTaskMessage({ taskId: "agentTasks:1", text: "Start with the logs" });
    assert.equal(sent.accepted, true);
    assert.equal((model.tables.threadParts[0].messages as unknown[]).length, 2);
    const late = await sendTaskMessage({ taskId: "agentTasks:3", text: "Hello?" });
    assert.equal(late.accepted === false && late.reason, "invalid-state");
  });

  test("answers an open question once, and a rejection settles it too", async () => {
    const answered = await answerTaskQuestion({
      taskId: "agentTasks:2",
      questionId: "q1",
      answer: "The first."
    });
    assert.equal(answered.accepted, true);
    const question = (model.tables.agentTasks[1].questions as { answer?: string }[])[0];
    assert.equal(question.answer, "The first.");
    const twice = await answerTaskQuestion({ taskId: "agentTasks:2", questionId: "q1", answer: "Again" });
    assert.equal(twice.accepted === false && twice.reason, "invalid-state");

    (model.tables.agentTasks[1].questions as unknown[]).push({ id: "q2", text: "Which colour?", askedAt: 7 });
    const declined = await answerTaskQuestion({ taskId: "agentTasks:2", questionId: "q2", reject: true });
    assert.equal(declined.accepted, true);
    const rejected = (model.tables.agentTasks[1].questions as { rejectedAt?: number }[])[1];
    assert.equal(rejected.rejectedAt, 500);
    await assert.rejects(
      () => answerTaskQuestion({ taskId: "agentTasks:2", questionId: "q2", answer: "x", reject: true }),
      /carries no answer/
    );
  });
});

describe("automations", () => {
  test("creates an unwritten rule switched off, and refuses to run or enable it", async () => {
    const result = await createAutomation({ personaId: "personas:a", name: "Blank" });
    assert.equal(result.accepted, true);
    const row = model.tables.automations.find((candidate) => candidate._id === result.id);
    assert.equal(row?.enabled, false);
    assert.equal(row?.instruction, "");
    const run = await runAutomation({ automationId: result.id });
    assert.equal(run.accepted === false && run.reason, "invalid-state");
    const on = await updateAutomation({ automationId: result.id, baseRevision: 1, patch: { enabled: true } });
    assert.equal(on.accepted === false && on.reason, "invalid-state");
  });

  test("runs a written rule into one task and counts the fire", async () => {
    const result = await runAutomation({ automationId: "automations:m" });
    assert.equal(result.accepted, true);
    const created = model.tables.agentTasks.find(
      (row) => result.accepted && row._id === result.taskId
    );
    assert.equal(created?.title, "Rule m");
    assert.deepEqual(created?.origin, {
      kind: "automation",
      automationId: "automations:m",
      trigger: "manual"
    });
    assert.equal(model.tables.automations[0].firedCount, 1);
    assert.equal(model.tables.automations[0].lastFiredAt, 500);
  });

  test("validates a trigger before anything is written", async () => {
    await assert.rejects(
      () =>
        updateAutomation({
          automationId: "automations:m",
          baseRevision: 3,
          patch: { trigger: { kind: "schedule", at: "25:00", repeats: "daily", timezone: "UTC" } }
        }),
      /HH:MM/
    );
    const weekly = await updateAutomation({
      automationId: "automations:m",
      baseRevision: 3,
      patch: {
        trigger: { kind: "schedule", at: "07:00", repeats: "weekly", weekday: "Monday", timezone: "UTC" }
      }
    });
    assert.equal(weekly.accepted, true);
  });

  test("rejects retired trigger selectors and non-current exact references", async () => {
    const triggers = [
      { kind: "resource-created", kinds: ["analysis"] },
      {
        kind: "resource-edited",
        kinds: ["externalFile"],
        ref: { kind: "externalFile", id: "externalFiles:1" }
      },
      {
        kind: "resource-edited",
        kinds: ["externalFile"],
        ref: { kind: "externalFile::pdf", id: "externalFiles:1" }
      },
      {
        kind: "resource-edited",
        kinds: ["document"],
        ref: { kind: "document", id: "spreadsheets:1" }
      },
      {
        kind: "resource-edited",
        kinds: ["document"],
        ref: { kind: "document", id: "documents:1", label: "Brief" }
      }
    ];
    const before = structuredClone(model.tables.automations);
    for (const trigger of triggers) {
      await assert.rejects(
        () => updateAutomation({
          automationId: "automations:m",
          baseRevision: 3,
          patch: { trigger }
        } as never),
        /current resource selectors|exact current resource reference/
      );
    }
    assert.deepEqual(model.tables.automations, before);
  });

  test("refuses to remove a rule that fired tasks still name", async () => {
    const held = await removeAutomation({ automationId: "automations:fired", baseRevision: 3 });
    assert.equal(held.accepted === false && held.reason, "in-use");
    const free = await removeAutomation({ automationId: "automations:m", baseRevision: 3 });
    assert.equal(free.accepted, true);
  });
});

describe("scope", () => {
  test("all persisted agent scope writers refuse a private Resource Set pointer", async () => {
    model.tables.resourceSets.push({
      _id: "resourceSets:private",
      _creationTime: 1,
      projectId: "projects:p",
      boundTo: { kind: "resource", resourceId: "documents:1", hole: "evidence" },
      set: {
        include: [{ select: "resources", refs: [{ kind: "document", id: "documents:1" }] }],
        exclude: []
      },
      createdBy: user("users:u"),
      revision: 1,
      updatedAt: 1
    });
    const privateScope = {
      include: [{ select: "set" as const, setId: "resourceSets:private" }],
      exclude: []
    };
    const before = structuredClone(model.tables);

    const personaResult = await updatePersona({
      personaId: "personas:a",
      baseRevision: 2,
      patch: { scope: privateScope }
    });
    const taskCreate = await createTask({
      personaId: "personas:a",
      title: "Unsafe scope",
      instruction: "Do not persist this.",
      scope: privateScope
    });
    const taskUpdate = await updateTask({
      taskId: "agentTasks:1",
      baseRevision: 1,
      patch: { scope: privateScope }
    });
    const automationCreate = await createAutomation({
      personaId: "personas:a",
      name: "Unsafe scope",
      scope: privateScope
    });
    const automationUpdate = await updateAutomation({
      automationId: "automations:m",
      baseRevision: 3,
      patch: { scope: privateScope }
    });

    for (const result of [
      personaResult,
      taskCreate,
      taskUpdate,
      automationCreate,
      automationUpdate
    ]) {
      assert.equal(result.accepted, false);
      assert.equal(result.accepted ? "" : result.reason, "invalid-state");
    }
    assert.deepEqual(model.tables, before);
  });

  test("copying or running persisted agent state cannot propagate a private pointer", async () => {
    const privateScope = {
      include: [{ select: "set", setId: "resourceSets:private" }],
      exclude: []
    };
    model.tables.personas[0].scope = privateScope;
    model.tables.automations[0].scope = privateScope;
    const before = structuredClone(model.tables);

    const copied = await duplicatePersona({ personaId: "personas:a" });
    const fired = await runAutomation({ automationId: "automations:m" });

    assert.equal(copied.accepted, false);
    assert.equal(copied.accepted ? "" : copied.reason, "invalid-state");
    assert.equal(fired.accepted, false);
    assert.equal(fired.accepted ? "" : fired.reason, "invalid-state");
    assert.deepEqual(model.tables, before);
  });

  test("a task inherits nothing by default, takes one, and gives it back", async () => {
    const library = await readAgentsLibrary();
    assert.equal(library.tasks.find((row) => row.id === "agentTasks:1")?.scope, null);

    const narrowed = await updateTask({
      taskId: "agentTasks:1",
      baseRevision: 1,
      patch: { scope: { include: [{ select: "resources", refs: [{ kind: "document", id: "documents:1" }] }], exclude: [] } }
    });
    assert.equal(narrowed.accepted, true);
    const after = await readAgentsLibrary();
    assert.deepEqual(after.tasks.find((row) => row.id === "agentTasks:1")?.scope?.include, [
      { select: "resources", refs: [{ kind: "document", id: "documents:1" }] }
    ]);

    const cleared = await updateTask({ taskId: "agentTasks:1", baseRevision: 2, patch: { scope: null } });
    assert.equal(cleared.accepted, true);
    const back = await readAgentsLibrary();
    assert.equal(back.tasks.find((row) => row.id === "agentTasks:1")?.scope, null);
  });

  test("a fired task carries the rule's scope", async () => {
    model.tables.resourceSets.push({
      _id: "resourceSets:1",
      _creationTime: 1,
      projectId: "projects:p",
      name: "Launch evidence",
      set: { include: [{ select: "project" }], exclude: [] },
      createdBy: user("users:u"),
      revision: 1,
      updatedAt: 1
    });
    model.tables.automations[0].scope = { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] };
    const result = await runAutomation({ automationId: "automations:m" });
    assert.equal(result.accepted, true);
    const created = model.tables.agentTasks.find((row) => result.accepted && row._id === result.taskId);
    assert.deepEqual(created?.scope, { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] });
  });
});

describe("chats", () => {
  test("opens a chat as a research thread in its own thread row", async () => {
    const result = await createChat({ personaId: "personas:b" });
    assert.equal(result.accepted, true);
    const chat = model.tables.researchThreads.find(
      (row) => result.accepted && row._id === result.chatId
    );
    assert.equal(chat?.title, "Chat with Persona b");
    assert.equal(chat?.personaId, "personas:b");
    assert.equal(
      model.tables.threads.some((row) => row._id === chat?.threadId && row.kind === "researchThread"),
      true
    );
    const missing = await createChat({ personaId: "personas:elsewhere" });
    assert.equal(missing.accepted === false && missing.reason, "not-found");
  });
});
