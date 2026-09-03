import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  snapshots: [] as Row[],
  changeSets: [] as Row[],
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table}`);
      const id = `${table}:${model.snapshots.length + model.changeSets.length + 1}`;
      if (table === "documentSnapshots") model.snapshots.push({ ...(fields as Row), _id: id });
      if (table === "documentChangeSets") model.changeSets.push({ ...(fields as Row), _id: id });
      return id;
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
      return { table: "documentSnapshots", kind: "table", rows: model.snapshots };
    },
    update: (path: string, value: unknown) => {
      model.calls.push(`update ${path}`);
      const id = path.split(".")[1];
      model.snapshots = model.snapshots.map((row) =>
        row._id === id ? { ...(value as Row), _id: id } : row
      );
    },
    remove: (path: string) => model.calls.push(`remove ${path}`)
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "u", username: "You" })
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

beforeEach(() => {
  model.calls.length = 0;
  model.snapshots.length = 0;
  model.changeSets.length = 0;
});

test("a document with no body reads as nothing", async () => {
  assert.equal(await readDocumentBody({ resourceId: "documents:1" }), null);
});

test("a read without a resourceId is refused", async () => {
  await assert.rejects(() => readDocumentBody({}), /resourceId is required/);
});

test("the first change set mints the leader snapshot at revision one", async () => {
  model.snapshots.push({
    _id: "documentSnapshots:1",
    projectId: "p",
    resourceId: "documents:1",
    role: "leader",
    revision: 0,
    part: 0,
    body: { rows: [row] },
    at: 1
  });

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
  model.snapshots.push({
    _id: "documentSnapshots:1",
    projectId: "p",
    resourceId: "documents:1",
    role: "leader",
    revision: 0,
    part: 0,
    body: { rows: [row] },
    at: 1
  });

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

test("a change set authored against an older revision is refused", async () => {
  model.snapshots.push({
    _id: "documentSnapshots:1",
    projectId: "p",
    resourceId: "documents:1",
    role: "leader",
    revision: 4,
    part: 0,
    body: { rows: [row] },
    at: 1
  });

  assert.deepEqual(await submitDocumentChanges(typing(2, 3, "x")), {
    accepted: false,
    reason: "stale",
    revision: 4,
    detail: "authored against revision 2, the leader is at 4"
  });
  assert.equal(model.changeSets.length, 0);
});

test("a change set whose ops do not resolve writes nothing", async () => {
  model.snapshots.push({
    _id: "documentSnapshots:1",
    projectId: "p",
    resourceId: "documents:1",
    role: "leader",
    revision: 0,
    part: 0,
    body: { rows: [row] },
    at: 1
  });

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
    projectId: "other",
    resourceId: "documents:1",
    role: "leader",
    revision: 3,
    part: 0,
    body: { rows: [row] },
    at: 1
  });

  assert.equal(await readDocumentBody({ resourceId: "documents:1" }), null);
});

test("an accepted change set marks the document updated", async () => {
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
