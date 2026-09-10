import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  tables: new Map<string, unknown>()
}));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({
    projectId: "projects:mine",
    userId: "users:me",
    username: "Me"
  })
}));

vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => ({
    store: {
      read: (table: string) => ({
        table,
        kind: "table",
        rows: model.tables.get(table) ?? []
      })
    }
  })
}));

const { readProjectComment } = await import(
  "$capabilities/project/api/read-project-comment/read-project-comment"
);
const { readProjectPerson } = await import(
  "$capabilities/project/api/read-project-person/read-project-person"
);
const { readProjectResource } = await import(
  "$capabilities/project/api/read-project-resource/read-project-resource"
);
const { emptyBody } = await import(
  "$representation/data/behavior/spreadsheets/empty-sheet"
);

const person = (id: string, name: string) => ({
  _id: id,
  _creationTime: 1,
  authSubject: `auth:${id}`,
  displayName: name,
  settings: "{}",
  updatedAt: 2
});

const membership = (userId: string) => ({
  _id: `memberships:${userId.replace(":", "-")}`,
  _creationTime: 2,
  projectId: "projects:mine",
  userId,
  token: `token:${userId}`,
  role: "editor"
});

const actor = (userId: string) => ({ kind: "user" as const, userId });

const document = () => ({
  _id: "documents:one",
  _creationTime: 3,
  projectId: "projects:mine",
  title: "Exact memo",
  createdBy: actor("users:me"),
  updatedBy: actor("users:me"),
  updatedAt: 4
});

const paragraph = (text: string) => ({
  id: "block:one",
  type: "text" as const,
  variant: "paragraph" as const,
  atoms: [{ id: "atom:one", kind: "literal" as const, text }],
  display: text,
  marks: []
});

const documentSnapshot = () => ({
  _id: "documentSnapshots:one",
  _creationTime: 4,
  projectId: "projects:mine",
  resourceId: "documents:one",
  revision: 1,
  role: "leader",
  part: 0,
  body: {
    rows: [{ id: "row:one", kind: "blocks", blocks: [paragraph("Three exact words")] }]
  },
  at: 4
});

const thread = (extra: Record<string, unknown> = {}) => ({
  _id: "commentThreads:one",
  _creationTime: 5,
  projectId: "projects:mine",
  target: { kind: "document", id: "documents:one" },
  within: {
    kind: "text",
    spans: [{
      blockId: "block:one",
      from: { atom: "atom:one", offset: 0 },
      to: { atom: "atom:one", offset: 5 }
    }]
  },
  createdBy: actor("users:me"),
  updatedAt: 6,
  ...extra
});

const comment = (extra: Record<string, unknown> = {}) => ({
  _id: "comments:one",
  _creationTime: 6,
  projectId: "projects:mine",
  threadId: "commentThreads:one",
  blocks: [paragraph("Exact comment")],
  mentions: [],
  author: actor("users:me"),
  ...extra
});

beforeEach(() => {
  model.tables.clear();
  model.tables.set("users", [person("users:me", "Me")]);
  model.tables.set("memberships", [membership("users:me")]);
  model.tables.set("documents", [document()]);
  model.tables.set("documentSnapshots", [documentSnapshot()]);
  model.tables.set("commentThreads", [thread()]);
  model.tables.set("comments", [comment()]);
});

describe("Project current-schema admission", () => {
  it("does not calculate a partial person from malformed identity or contribution rows", async () => {
    await expect(readProjectPerson({ userId: "users:me" })).resolves.toMatchObject({
      contribution: { comments: 1, resources: 1 }
    });

    model.tables.set("users", [person("users:me", "Me"), person("users:me", "Duplicate")]);
    await expect(readProjectPerson({ userId: "users:me" })).resolves.toBeNull();

    model.tables.set("users", [person("users:me", "Me")]);
    model.tables.set("comments", [comment({ blocks: [{ display: "partial" }] })]);
    await expect(readProjectPerson({ userId: "users:me" })).resolves.toBeNull();

    model.tables.set("comments", [comment()]);
    model.tables.set("documents", [{ ...document(), unknownField: true }]);
    await expect(readProjectPerson({ userId: "users:me" })).resolves.toBeNull();
  });

  it("rejects malformed nested document bodies and comment-count claimants", async () => {
    await expect(readProjectResource({ resourceId: "documents:one" })).resolves.toMatchObject({
      facts: [
        { label: "Words", value: "3" },
        { label: "Comments", value: "1" }
      ]
    });

    const snapshot = documentSnapshot();
    snapshot.body.rows[0].blocks = [{ ...paragraph("partial"), atoms: [] }];
    model.tables.set("documentSnapshots", [snapshot]);
    await expect(readProjectResource({ resourceId: "documents:one" })).resolves.toBeNull();

    model.tables.set("documentSnapshots", [documentSnapshot()]);
    model.tables.set("commentThreads", [{
      _id: "commentThreads:bad",
      projectId: "projects:mine",
      target: { kind: "document", id: "documents:one" }
    }]);
    await expect(readProjectResource({ resourceId: "documents:one" })).resolves.toBeNull();
  });

  it("validates complete spreadsheet cells and their body coordinates before counting", async () => {
    const body = emptyBody();
    model.tables.set("spreadsheets", [{
      _id: "spreadsheets:one",
      _creationTime: 3,
      projectId: "projects:mine",
      title: "Exact sheet",
      createdBy: actor("users:me"),
      updatedBy: actor("users:me"),
      updatedAt: 4
    }]);
    model.tables.set("spreadsheetSnapshots", [{
      _id: "spreadsheetSnapshots:one",
      _creationTime: 4,
      projectId: "projects:mine",
      resourceId: "spreadsheets:one",
      revision: 1,
      role: "leader",
      part: 0,
      body,
      at: 4
    }]);
    const cell = {
      _id: "sheetCells:one",
      _creationTime: 5,
      projectId: "projects:mine",
      resourceId: "spreadsheets:one",
      rowOrder: 1,
      rowId: "r1",
      columnId: "c1",
      value: { kind: "number", value: 7 }
    };
    model.tables.set("sheetCells", [cell]);

    await expect(readProjectResource({ resourceId: "spreadsheets:one" })).resolves.toMatchObject({
      facts: expect.arrayContaining([{ label: "Filled cells", value: "1" }])
    });

    model.tables.set("sheetCells", [{ ...cell, rowOrder: 99 }]);
    await expect(readProjectResource({ resourceId: "spreadsheets:one" })).resolves.toBeNull();

    model.tables.set("sheetCells", [{ ...cell, retiredValue: 7 }]);
    await expect(readProjectResource({ resourceId: "spreadsheets:one" })).resolves.toBeNull();
  });

  it("enforces target/anchor families and keeps unavailable historical actors null", async () => {
    model.tables.set("comments", []);
    await expect(readProjectComment({ threadId: "commentThreads:one" })).resolves.toBeNull();

    model.tables.set("comments", [comment()]);
    model.tables.set("commentThreads", [thread({
      within: { kind: "slide", slideId: "slide:one" }
    })]);
    await expect(readProjectComment({ threadId: "commentThreads:one" })).resolves.toBeNull();

    model.tables.set("commentThreads", [thread({
      target: { kind: "slides", id: "documents:one" },
      within: undefined
    })]);
    await expect(readProjectComment({ threadId: "commentThreads:one" })).resolves.toBeNull();

    model.tables.set("commentThreads", [thread()]);
    model.tables.set("comments", [comment({ author: actor("users:former") })]);
    await expect(readProjectComment({ threadId: "commentThreads:one" })).resolves.toMatchObject({
      opening: { author: null }
    });
    const result = await readProjectComment({ threadId: "commentThreads:one" });
    expect(result?.opening).not.toHaveProperty("authorLabel");
  });
});
