import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  snapshots: [] as Row[],
  changeSets: [] as Row[],
  syncJobs: [] as Row[],
  materialJobs: [] as Row[],
  threads: [] as Row[],
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table}`);
      const id = `${table}:${model.snapshots.length + model.changeSets.length + 1}`;
      const row = { ...(fields as Row), _id: id, _creationTime: Date.now() };
      if (table === "documentSnapshots") model.snapshots.push(row);
      if (table === "documentChangeSets") model.changeSets.push(row);
      if (table === "semanticSyncJobs") model.syncJobs.push(row);
      if (table === "semanticMaterialJobs") model.materialJobs.push(row);
      return id;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      if (path === "documentChangeSets") {
        return { table: "documentChangeSets", kind: "table", rows: model.changeSets };
      }
      if (path === "commentThreads") {
        return { table: "commentThreads", kind: "table", rows: model.threads };
      }
      if (path === "semanticSyncJobs") {
        return { table: "semanticSyncJobs", kind: "table", rows: model.syncJobs };
      }
      if (path === "semanticMaterialJobs") {
        return { table: "semanticMaterialJobs", kind: "table", rows: model.materialJobs };
      }
      if (path === "templateStages") {
        return { table: "templateStages", kind: "table", rows: [] };
      }
      return { table: "documentSnapshots", kind: "table", rows: model.snapshots };
    },
    update: (path: string, value: unknown) => {
      model.calls.push(`update ${path}`);
      if (path.startsWith("commentThreads.")) {
        const [, id, field] = path.split(".");
        model.threads = model.threads.map((row) =>
          row._id === id ? { ...row, [field]: value } : row
        );
        return;
      }
      const id = path.split(".")[1];
      model.snapshots = model.snapshots.map((row) =>
        row._id === id
          ? { ...(value as Row), _id: id, _creationTime: row._creationTime }
          : row
      );
    },
    remove: (path: string) => {
      model.calls.push(`remove ${path}`);
      if (path.startsWith("commentThreads.")) {
        const [, id, field] = path.split(".");
        model.threads = model.threads.map((held) => {
          if (held._id !== id) return held;
          const { [field]: removed, ...row } = held;
          void removed;
          return row as Row;
        });
      }
    },
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T =>
      work(model.store as unknown as StoreUnitOfWork)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({
    projectId: "projects:p",
    userId: "users:u",
    username: "You"
  })
}));

const { readDocumentBody } = await import(
  "$capabilities/document/api/read-document-body/read-document-body"
);
const { submitDocumentChanges } = await import(
  "$capabilities/document/api/submit-document-changes/submit-document-changes"
);

const row = {
  id: "#r1",
  kind: "blocks",
  blocks: [
    {
      id: "#b1",
      type: "text",
      variant: "paragraph",
      atoms: [{ id: "#a1", kind: "literal", text: "One" }],
      display: "One",
      marks: []
    }
  ]
};

const leaderAt = (revision: number, body: unknown = { rows: [row] }) =>
  model.snapshots.push({
    _id: "documentSnapshots:1",
    _creationTime: 1,
    projectId: "projects:p",
    resourceId: "documents:1",
    role: "leader",
    revision,
    part: 0,
    body,
    at: 1
  });

const sending = (baseRevision: number, ops: unknown[]) => ({
  changeSet: {
    resourceId: "documents:1",
    baseRevision,
    ops,
    touched: [...new Set(ops.map((op) => (op as { path: string }).path))]
  }
});

const typing = (baseRevision: number, at: number, insert: string) =>
  sending(baseRevision, [
    { op: "text", target: "atom", path: "#b1/atoms/#a1", at, insert, remove: "" }
  ]);

const margin = (baseRevision: number, top: number) =>
  sending(baseRevision, [
    { op: "set", target: "document", path: "pageSetup/margins/top", value: top, was: 0.75 }
  ]);

beforeEach(() => {
  model.calls.length = 0;
  model.snapshots.length = 0;
  model.changeSets.length = 0;
  model.syncJobs.length = 0;
  model.materialJobs.length = 0;
  model.threads.length = 0;
});

test("a document with no body reads as nothing", async () => {
  assert.equal(await readDocumentBody({ resourceId: "documents:1" }), null);
});

test("a read without a resourceId is refused", async () => {
  await assert.rejects(() => readDocumentBody({}), /resourceId is required/);
});

test("the first change set mints the leader snapshot at revision one", async () => {
  leaderAt(0);

  const accepted = await submitDocumentChanges(typing(0, 3, " more"));

  assert.deepEqual(accepted, { accepted: true, revision: 1 });
  assert.deepEqual(await readDocumentBody({ resourceId: "documents:1" }), {
    revision: 1,
    body: {
      rows: [
        {
          ...row,
          blocks: [
            {
              ...row.blocks[0],
              atoms: [{ id: "#a1", kind: "literal", text: "One more" }],
              display: "One more"
            }
          ]
        }
      ]
    }
  });
});

test("every accepted change set is written, and the revisions ascend", async () => {
  leaderAt(0);

  await submitDocumentChanges(typing(0, 3, "a"));
  await submitDocumentChanges(typing(1, 4, "b"));

  assert.deepEqual(
    model.changeSets.map((set) => [set.revision, set.baseRevision, set.tier]),
    [
      [1, 0, "recent"],
      [2, 1, "recent"]
    ]
  );
  assert.deepEqual(model.changeSets[0].touched, ["#b1/atoms/#a1"]);
  assert.equal(model.snapshots.length, 1);
});

test("accepted text edits move structural comment anchors with their cited text", async () => {
  leaderAt(0);
  model.threads.push({
    _id: "commentThreads:1",
    _creationTime: 1,
    projectId: "projects:p",
    target: { kind: "document", id: "documents:1" },
    within: {
      kind: "text",
      spans: [
        {
          blockId: "#b1",
          from: { atom: "#a1", offset: 0 },
          to: { atom: "#a1", offset: 3 }
        }
      ]
    },
    createdBy: { kind: "user", userId: "users:u" },
    updatedAt: 1
  });

  await submitDocumentChanges(typing(0, 0, "A "));

  assert.deepEqual(model.threads[0].within, {
    kind: "text",
    spans: [
      {
        blockId: "#b1",
        from: { atom: "#a1", offset: 2 },
        to: { atom: "#a1", offset: 5 }
      }
    ]
  });
});

test("an edit detaches a comment whose last live span disappeared", async () => {
  leaderAt(0);
  model.threads.push({
    _id: "commentThreads:1",
    _creationTime: 1,
    projectId: "projects:p",
    target: { kind: "document", id: "documents:1" },
    within: {
      kind: "text",
      spans: [{
        blockId: "#removed",
        from: { atom: "#gone", offset: 0 },
        to: { atom: "#gone", offset: 3 }
      }]
    },
    createdBy: { kind: "user", userId: "users:u" },
    updatedAt: 1
  });

  await submitDocumentChanges(typing(0, 0, "A "));

  assert.equal(Object.hasOwn(model.threads[0], "within"), false);
  assert.equal(
    model.calls.includes("remove commentThreads.commentThreads:1.within"),
    true
  );
});

test("a change set authored against an older revision is refused when the changes since cannot be read", async () => {
  leaderAt(4);

  assert.deepEqual(await submitDocumentChanges(typing(2, 3, "x")), {
    accepted: false,
    reason: "stale",
    revision: 4,
    detail: "authored against revision 2, the leader is at 4"
  });
  assert.equal(model.changeSets.length, 0);
});

test("a change set authored against an older revision is refused when a change since touched the same path", async () => {
  leaderAt(0);
  await submitDocumentChanges(typing(0, 3, "a"));

  const refused = await submitDocumentChanges(typing(0, 3, "b"));

  assert.equal(refused.accepted, false);
  assert.equal(refused.accepted === false && refused.reason, "stale");
  assert.equal(model.changeSets.length, 1);
});

test("a change set authored against an older revision is accepted with catch-up when nothing since touches its paths", async () => {
  leaderAt(0, { rows: [row], pageSetup: { paper: "letter", orientation: "portrait", margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 } } });
  await submitDocumentChanges(margin(0, 1));

  const accepted = await submitDocumentChanges(typing(0, 3, "!"));

  assert.deepEqual(accepted, {
    accepted: true,
    revision: 2,
    catchUp: [{ op: "set", target: "document", path: "pageSetup/margins/top", value: 1, was: 0.75 }]
  });

  const read = await readDocumentBody({ resourceId: "documents:1" });
  assert.equal(read?.body.pageSetup?.margins.top, 1);
  assert.equal(
    read?.body.rows[0].kind === "blocks" && read.body.rows[0].blocks[0].type === "text"
      ? read.body.rows[0].blocks[0].display
      : undefined,
    "One!"
  );
});

test("a change set whose ops do not resolve writes nothing", async () => {
  leaderAt(0);

  const refused = await submitDocumentChanges(
    sending(0, [
      { op: "text", target: "atom", path: "#gone/atoms/#a1", at: 0, insert: "x", remove: "" }
    ])
  );

  assert.equal(refused.accepted, false);
  assert.equal(refused.accepted === false && refused.reason, "unresolved");
  assert.match(refused.accepted === false ? refused.detail : "", /No block #gone/);

  assert.equal(model.changeSets.length, 0);
  assert.equal(model.snapshots[0].revision, 0);
});

test("an empty change set is refused before anything is read", async () => {
  await assert.rejects(() => submitDocumentChanges(sending(0, [])), /at least one op/);
});

test("malformed operations are refused before anything is read or written", async () => {
  const malformed = [
    { op: "text", target: "atom", path: "#b1/atoms/#a1", at: -1, insert: "x", remove: "" },
    { op: "text", target: "block", path: "#b1/atoms/#a1", at: 0, insert: "x", remove: "" },
    { op: "insert", target: "row", path: "rows", ids: ["#r1"], after: null, values: [] },
    { op: "remove", target: "row", path: "rows", ids: ["#r1", "#r1"], after: null, values: [row, row] },
    { op: "move", target: "atom", path: "#b1/atoms", id: "#a1", after: null, wasAfter: null },
    { op: "set", target: "atom", path: "#a1/text", value: "x", was: "" }
  ];

  for (const op of malformed) {
    await assert.rejects(
      () => submitDocumentChanges(sending(0, [op])),
      /every op names an operation, a target and a path/
    );
  }

  assert.equal(model.calls.length, 0);
});

test("a change set whose touched disagrees with its ops is refused", async () => {
  await assert.rejects(
    () =>
      submitDocumentChanges({
        changeSet: {
          resourceId: "documents:1",
          baseRevision: 0,
          ops: [{ op: "text", target: "atom", path: "#b1/atoms/#a1", at: 0, insert: "x", remove: "" }],
          touched: ["#somewhere/else"]
        }
      }),
    /touched disagrees with the ops/
  );
});

test("another project's leader is not this one's", async () => {
  model.snapshots.push({
    _id: "documentSnapshots:1",
    _creationTime: 1,
    projectId: "projects:other",
    resourceId: "documents:1",
    role: "leader",
    revision: 3,
    part: 0,
    body: { rows: [row] },
    at: 1
  });

  assert.equal(await readDocumentBody({ resourceId: "documents:1" }), null);
});

test("a document without its canonical leader snapshot is refused rather than bootstrapped", async () => {
  const refused = await submitDocumentChanges(
    sending(0, [
      { op: "insert", target: "row", path: "rows", ids: ["#r1"], after: null, values: [row] }
    ])
  );

  assert.deepEqual(refused, {
    accepted: false,
    reason: "unresolved",
    revision: 0,
    detail: "no body is stored for documents:1"
  });
  assert.equal(model.snapshots.length, 0);
  assert.equal(model.changeSets.length, 0);
  assert.equal(model.calls.some((call) => call.startsWith("update documents.")), false);
});

test("an accepted change set marks the document updated", async () => {
  leaderAt(0);
  await submitDocumentChanges(
    sending(0, [
      { op: "insert", target: "row", path: "rows", ids: ["#r1"], after: null, values: [row] }
    ])
  );

  assert.equal(
    model.calls.some((call) => call === "update documents.documents:1.updatedAt"),
    true
  );
});
