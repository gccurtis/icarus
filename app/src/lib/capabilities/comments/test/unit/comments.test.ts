import assert from "node:assert/strict";
import { beforeEach, describe, it, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  tables: new Map<string, Row[]>(),
  writes: [] as { path: string; value: unknown }[],
  removals: [] as string[],
  transactions: 0,
  failCreateTable: undefined as string | undefined,
  store: {
    create: (table: string, fields: Record<string, unknown>) => {
      if (model.failCreateTable === table) throw new Error(`failed creating ${table}`);
      const rows = model.tables.get(table) ?? [];
      const id = `${table}:${rows.length + 1}`;
      model.tables.set(table, [...rows, { ...fields, _id: id }]);
      return id;
    },
    read: (path: string) => ({ table: path, kind: "table", rows: model.tables.get(path) ?? [] }),
    update: (path: string, value: unknown) => {
      model.writes.push({ path, value });
    },
    remove: (path: string) => {
      model.removals.push(path);
    },
    transaction: <T>(work: (unit: typeof model.store) => T): T => {
      model.transactions += 1;
      const before = new Map(
        [...model.tables].map(([table, rows]) => [table, structuredClone(rows)] as const)
      );
      const writes = [...model.writes];
      const removals = [...model.removals];
      try {
        return work(model.store);
      } catch (error) {
        model.tables = before;
        model.writes = writes;
        model.removals = removals;
        throw error;
      }
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "projects:p", userId: "users:1", username: "You" })
}));

const { startThread } = await import("$capabilities/comments/api/start-thread/start-thread");
const { reply } = await import("$capabilities/comments/api/reply/reply");
const { resolveThread } = await import("$capabilities/comments/api/resolve-thread/resolve-thread");
const { readComments } = await import("$capabilities/comments/api/read-comments/read-comments");
const { validateStartThread } = await import("$capabilities/comments/api/start-thread/validate-start-thread");
const { validateReply } = await import("$capabilities/comments/api/reply/validate-reply");
const { validateResolveThread } = await import("$capabilities/comments/api/resolve-thread/validate-resolve-thread");

const currentResource = (table: "documents" | "slideDecks" | "spreadsheets", id: string, title: string): Row => ({
  _id: `${table}:${id}`,
  _creationTime: 1,
  projectId: "projects:p",
  title,
  createdBy: { kind: "system" },
  updatedBy: { kind: "system" },
  updatedAt: 1
});

const currentUser = (id = "users:1", name = "You"): Row => ({
  _id: id,
  _creationTime: 1,
  authSubject: `auth:${id}`,
  displayName: name,
  settings: "{}",
  updatedAt: 1
});

const currentMembership = (id = "memberships:1", userId = "users:1"): Row => ({
  _id: id,
  _creationTime: 1,
  projectId: "projects:p",
  userId,
  token: `token:${id}`,
  role: "owner"
});

const paragraph = (id: string, display: string) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}:atom`, kind: "literal", text: display }],
  display,
  marks: []
});

const currentThread = (
  id: string,
  projectId = "projects:p",
  extra: Record<string, unknown> = {}
): Row => ({
  _id: `commentThreads:${id}`,
  _creationTime: 1,
  projectId,
  target: { kind: "slides", id: projectId === "projects:p" ? "slideDecks:1" : "slideDecks:2" },
  createdBy: { kind: "system" },
  updatedAt: 1,
  ...extra
});

beforeEach(() => {
  model.tables = new Map();
  model.writes = [];
  model.removals = [];
  model.transactions = 0;
  model.failCreateTable = undefined;
  model.tables.set("slideDecks", [currentResource("slideDecks", "1", "Deck")]);
  model.tables.set("documents", [currentResource("documents", "1", "Document")]);
  model.tables.set("spreadsheets", [currentResource("spreadsheets", "1", "Sheet")]);
  model.tables.set("memberships", [currentMembership()]);
  model.tables.set("users", [currentUser()]);
});

describe("startThread", () => {
  it("refuses a thread on a template's working copy", async () => {
    model.tables.set("templateStages", [
      {
        _id: "templateStages:1",
        _creationTime: 1,
        projectId: "projects:p",
        templateId: "templates:1",
        templateRevision: 1,
        target: "slides",
        resourceId: "slideDecks:1",
        createdBy: { kind: "system" },
        updatedAt: 1
      }
    ]);

    await assert.rejects(
      () => startThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "Not here" }),
      /working copy takes no comments/
    );
    assert.equal(model.tables.get("commentThreads"), undefined);
  });

  it("files a thread and its first comment under the asking user and project", async () => {
    const made = await startThread({
      target: { kind: "slides", id: "slideDecks:1" },
      within: { kind: "element", elementId: "el-5" },
      text: "  Is this the right feeder?  "
    });

    const thread = model.tables.get("commentThreads")?.[0];
    const comment = model.tables.get("comments")?.[0];
    assert.equal(made.threadId, thread?._id);
    assert.equal(made.commentId, comment?._id);
    assert.equal(thread?.projectId, "projects:p");
    assert.deepEqual(thread?.createdBy, { kind: "user", userId: "users:1" });
    assert.deepEqual(thread?.within, { kind: "element", elementId: "el-5" });
    assert.equal(comment?.threadId, thread?._id);
    assert.equal((comment?.blocks as { display: string }[])[0].display, "Is this the right feeder?");
    assert.equal(model.transactions, 1);
  });

  it("rolls back the thread when its opening comment cannot be written", async () => {
    model.failCreateTable = "comments";
    await assert.rejects(
      startThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "Atomic" }),
      /failed creating comments/
    );
    assert.equal(model.tables.get("commentThreads"), undefined);
  });

  it("refuses a target that belongs to another project", async () => {
    model.tables.set("slideDecks", [{
      ...currentResource("slideDecks", "2", "Other"),
      projectId: "projects:other"
    }]);
    await assert.rejects(
      startThread({ target: { kind: "slides", id: "slideDecks:2" }, text: "No" }),
      /no slides/
    );
  });

  it("fails closed on partial or duplicate target rows", async () => {
    model.tables.set("slideDecks", [{
      _id: "slideDecks:1",
      _creationTime: 1,
      projectId: "projects:p",
      title: "Partial"
    }]);
    await assert.rejects(
      startThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "No" }),
      /missing required fields/
    );

    model.tables.set("slideDecks", [
      currentResource("slideDecks", "1", "Deck"),
      currentResource("slideDecks", "1", "Duplicate")
    ]);
    await assert.rejects(
      startThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "Still no" }),
      /repeats row id/
    );
    assert.equal(model.tables.get("commentThreads"), undefined);
  });

  it("refuses an empty remark and an unknown anchor", () => {
    assert.throws(() => validateStartThread({ target: { kind: "slides", id: "slideDecks:1" }, text: "  " }));
    assert.throws(() => validateStartThread({ target: { kind: "slides", id: "slideDecks:1" }, within: { kind: "page" }, text: "x" }));
    assert.throws(() => validateStartThread({ target: { kind: "photo", id: "x" }, text: "x" }));
  });

  it("accepts the current multi-block text anchor representation", () => {
    const within = {
      kind: "text",
      spans: [
        {
          blockId: "block-1",
          from: { atom: "atom-1", offset: 2 },
          to: { atom: "atom-1", offset: 5 }
        },
        {
          blockId: "block-2",
          from: { atom: "atom-2", offset: 0 },
          to: { atom: "atom-2", offset: 3 }
        }
      ]
    };

    assert.deepEqual(
      validateStartThread({ target: { kind: "document", id: "documents:1" }, within, text: "Review" }).within,
      within
    );
    assert.throws(() =>
      validateStartThread({
        target: { kind: "document", id: "documents:1" },
        within: { kind: "text", blockId: "block-1", from: 0, to: 3 },
        text: "Review"
      })
    );
  });

  it("rejects non-data command and anchor objects without invoking accessors", () => {
    const command = {
      target: { kind: "slides", id: "slideDecks:1" },
      text: "Review"
    };
    const hidden = { ...command };
    Object.defineProperty(hidden, "retired", { value: true, enumerable: false });
    const accessor = { text: "Review" } as typeof command;
    Object.defineProperty(accessor, "target", {
      enumerable: true,
      get: () => {
        throw new Error("accessor was invoked");
      }
    });
    const inherited = Object.assign(Object.create({ retired: true }), command);

    for (const input of [
      hidden,
      accessor,
      inherited,
      { ...command, within: undefined },
      { ...command, [Symbol("retired")]: true }
    ]) {
      assert.throws(() => validateStartThread(input), /exact object/);
    }

    const nested = { kind: "element", elementId: "element-1" };
    Object.defineProperty(nested, "retired", { value: true, enumerable: false });
    assert.throws(
      () => validateStartThread({ ...command, within: nested }),
      /within must be an anchor/
    );
    assert.throws(
      () => validateStartThread({ ...command, within: null }),
      /within must be an anchor/
    );
  });
});

describe("reply and resolve", () => {
  it("admits only exact current command objects and nominal thread ids", () => {
    const hidden = { threadId: "commentThreads:1", text: "Yes" };
    Object.defineProperty(hidden, "retired", { value: true, enumerable: false });
    const inherited = Object.assign(Object.create({ retired: true }), {
      threadId: "commentThreads:1",
      resolved: true
    });

    for (const input of [
      hidden,
      { threadId: "commentThreads:1", text: "Yes", retired: undefined },
      { threadId: "commentThreads:1", text: "Yes", [Symbol("retired")]: true }
    ]) {
      assert.throws(() => validateReply(input), /exact object/);
    }
    assert.throws(() => validateReply({ threadId: "thread-1", text: "Yes" }), /threadId/);
    assert.throws(() => validateResolveThread(inherited), /exact object/);
    assert.throws(
      () => validateResolveThread({ threadId: "threads:1", resolved: true }),
      /threadId/
    );
  });

  it("replies only into a thread of the asking project", async () => {
    model.tables.set("commentThreads", [
      currentThread("1"),
      currentThread("2", "projects:other")
    ]);

    const made = await reply({ threadId: "commentThreads:1", text: "Yes." });
    assert.equal(model.tables.get("comments")?.[0]._id, made.commentId);
    assert.equal(model.writes[0]?.path, "commentThreads.commentThreads:1.updatedAt");

    await assert.rejects(reply({ threadId: "commentThreads:2", text: "No." }));
  });

  it("settles a thread with who did it, and reopens by removing that", async () => {
    model.tables.set("commentThreads", [
      currentThread("1", "projects:p", { resolution: { by: "users:1", at: 1 } })
    ]);

    await resolveThread({ threadId: "commentThreads:1", resolved: true });
    const written = model.writes.find((write) => write.path.endsWith(".resolution"));
    assert.equal((written?.value as { by: string }).by, "users:1");

    await resolveThread({ threadId: "commentThreads:1", resolved: false });
    assert.deepEqual(model.removals, ["commentThreads.commentThreads:1.resolution"]);
  });

  it("refuses replies and resolution changes on a partial current-row claimant", async () => {
    model.tables.set("commentThreads", [{
      _id: "commentThreads:1",
      projectId: "projects:p",
      target: { kind: "slides", id: "slideDecks:1" }
    }]);

    await assert.rejects(reply({ threadId: "commentThreads:1", text: "No" }));
    await assert.rejects(resolveThread({ threadId: "commentThreads:1", resolved: true }));
    assert.equal(model.tables.get("comments"), undefined);
    assert.deepEqual(model.writes, []);
    assert.deepEqual(model.removals, []);
  });
});

describe("readComments", () => {
  it("projects owned current-shape threads", async () => {
    model.tables.set("commentThreads", [
      {
        _id: "commentThreads:1",
        _creationTime: 1,
        projectId: "projects:p",
        target: { kind: "document", id: "documents:1" },
        within: {
          kind: "text",
          spans: [{
            blockId: "block-1",
            from: { atom: "atom-1", offset: 0 },
            to: { atom: "atom-1", offset: 2 }
          }]
        },
        createdBy: { kind: "user", userId: "users:1" },
        updatedAt: 1
      }
    ]);
    model.tables.set("comments", [
      {
        _id: "comments:1",
        _creationTime: 1,
        projectId: "projects:p",
        threadId: "commentThreads:1",
        blocks: [paragraph("comment-1", "Current")],
        mentions: [],
        author: { kind: "user", userId: "users:1" }
      }
    ]);

    const projected = await readComments();
    assert.deepEqual(projected.threads.map((thread) => thread._id), ["commentThreads:1"]);
    assert.deepEqual(projected.remarks.map((remark) => remark._id), ["comments:1"]);
    assert.deepEqual(projected.people, [{ _id: "users:1", displayName: "You" }]);
    assert.equal("authSubject" in projected.people[0], false);
  });

  it("fails closed on a retired flat text anchor", async () => {
    model.tables.set("commentThreads", [{
      _id: "commentThreads:flat",
      _creationTime: 1,
      projectId: "projects:p",
      target: { kind: "document", id: "documents:1" },
      within: { kind: "text", blockId: "block-1", from: 0, to: 2 },
      createdBy: { kind: "user", userId: "users:1" },
      updatedAt: 1
    }]);

    await assert.rejects(() => readComments(), /non-current field values/);
  });

  it("admits every current mention arm and recursively projects image and table blocks", async () => {
    model.tables.set("agentTasks", [{
      _id: "agentTasks:1",
      _creationTime: 1,
      projectId: "projects:p",
      threadId: "threads:1",
      title: "Agent",
      instruction: "Review",
      personaId: "personas:1",
      origin: { kind: "person" },
      state: "running",
      execution: { kind: "grounded" },
      tools: [],
      plan: [],
      outputs: [],
      questions: [],
      createdBy: { kind: "system" },
      startedAt: 1,
      revision: 1,
      updatedAt: 1
    }]);
    model.tables.set("connectors", [{
      _id: "connectors:1",
      _creationTime: 1,
      projectId: "projects:p",
      name: "Drive",
      configuration: { kind: "provider", provider: "googleDrive", selection: "folder" },
      createdBy: { kind: "system" },
      updatedAt: 1
    }]);
    model.tables.set("commentThreads", [{
      _id: "commentThreads:1",
      _creationTime: 1,
      projectId: "projects:p",
      target: { kind: "document", id: "documents:1" },
      createdBy: { kind: "system" },
      updatedAt: 1
    }]);
    model.tables.set("comments", [{
      _id: "comments:1",
      _creationTime: 1,
      projectId: "projects:p",
      threadId: "commentThreads:1",
      blocks: [
        { id: "image-1", type: "image", alt: "Diagram" },
        {
          id: "table-1",
          type: "table",
          headerRows: 0,
          rows: [{
            id: "row-1",
            cells: [{ id: "cell-1", blocks: [paragraph("cell-text", "Cell value")] }]
          }]
        }
      ],
      mentions: [
        { kind: "url", url: "https://example.test", note: "source" },
        { kind: "actor", actor: { kind: "system" } },
        { kind: "actor", actor: { kind: "user", userId: "users:1" } },
        { kind: "actor", actor: { kind: "agent", taskId: "agentTasks:1" } },
        { kind: "actor", actor: { kind: "connector", connectorId: "connectors:1" } },
        { kind: "persona", personaId: "personas:1" },
        { kind: "resource", ref: { kind: "document", id: "documents:1" } }
      ],
      author: { kind: "system" }
    }]);

    const projected = await readComments();
    assert.equal(projected.remarks[0]?.text, "Diagram\nCell value");
    assert.deepEqual(projected.remarks[0]?.mentionedUserIds, ["users:1"]);
  });

  it("fails closed on a partial comment row or duplicate target", async () => {
    model.tables.set("commentThreads", [{
      _id: "commentThreads:1",
      _creationTime: 1,
      projectId: "projects:p",
      target: { kind: "document", id: "documents:1" },
      createdBy: { kind: "user", userId: "users:1" },
      updatedAt: 1
    }]);
    model.tables.set("comments", [
      {
        _id: "comments:1",
        _creationTime: 1,
        projectId: "projects:p",
        threadId: "commentThreads:1",
        blocks: [paragraph("valid", "Valid")],
        mentions: [],
        author: { kind: "user", userId: "users:1" }
      },
      {
        _id: "comments:2",
        threadId: "commentThreads:1",
        blocks: [{ display: "partial" }]
      }
    ]);

    await assert.rejects(() => readComments(), /creation time|non-current field values/);

    model.tables.set("comments", [{
      _id: "comments:1",
      _creationTime: 1,
      projectId: "projects:p",
      threadId: "commentThreads:1",
      blocks: [paragraph("valid", "Valid")],
      mentions: [],
      author: { kind: "user", userId: "users:1" }
    }]);
    model.tables.set("documents", [
      currentResource("documents", "1", "Document"),
      { _id: "documents:1", projectId: "projects:p", title: "partial duplicate" }
    ]);
    await assert.rejects(() => readComments(), /creation time|repeats row id/);
  });

  it("does not project a foreign user id through authors or mentions", async () => {
    model.tables.set("users", [currentUser(), currentUser("users:2", "Other")]);
    model.tables.set("commentThreads", [{
      _id: "commentThreads:1",
      _creationTime: 1,
      projectId: "projects:p",
      target: { kind: "document", id: "documents:1" },
      createdBy: { kind: "user", userId: "users:2" },
      updatedAt: 1
    }]);
    model.tables.set("comments", [{
      _id: "comments:1",
      _creationTime: 1,
      projectId: "projects:p",
      threadId: "commentThreads:1",
      blocks: [paragraph("comment-1", "Private actor")],
      mentions: [{ kind: "actor", actor: { kind: "user", userId: "users:2" } }],
      author: { kind: "user", userId: "users:2" }
    }]);

    const projected = await readComments();
    assert.deepEqual(projected.threads, []);
    assert.deepEqual(projected.remarks, []);
    assert.equal(JSON.stringify(projected).includes("users:2"), false);
  });

  it("fails closed on a mention actor with a non-nominal id", async () => {
    model.tables.set("commentThreads", [currentThread("1")]);
    model.tables.set("comments", [{
      _id: "comments:1",
      _creationTime: 1,
      projectId: "projects:p",
      threadId: "commentThreads:1",
      blocks: [paragraph("comment-1", "Bad mention")],
      mentions: [{ kind: "actor", actor: { kind: "user", userId: "banana" } }],
      author: { kind: "user", userId: "users:1" }
    }]);

    await assert.rejects(() => readComments(), /non-current field values/);
  });
});
