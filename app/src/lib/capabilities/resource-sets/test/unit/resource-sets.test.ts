import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const model = vi.hoisted(() => ({
  scope: { projectId: "projects:p", userId: "users:u", username: "Uma" },
  tables: {} as Record<string, Row[]>,
  store: {
    create: (table: string, fields: unknown) => {
      const rows = (model.tables[table] ??= []);
      const id = `${table}:${rows.length + 1}`;
      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: 1 });
      return id;
    },
    read: (path: string) => {
      const [table] = path.split(".");
      return { table, kind: "table", rows: model.tables[table] ?? [] };
    },
    update: (path: string, value: unknown) => {
      const [table, id] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      rows[index] = { ...(value as Record<string, unknown>), _id: id, _creationTime: rows[index]._creationTime };
    },
    remove: (path: string) => {
      const [table, id] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      rows.splice(index, 1);
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve(model.scope)
}));

const { createResourceSet } = await import(
  "$capabilities/resource-sets/api/create-resource-set/create-resource-set"
);
const { readResourceSets } = await import(
  "$capabilities/resource-sets/api/read-resource-sets/read-resource-sets"
);
const { removeResourceSet } = await import(
  "$capabilities/resource-sets/api/remove-resource-set/remove-resource-set"
);
const { updateResourceSet } = await import(
  "$capabilities/resource-sets/api/update-resource-set/update-resource-set"
);
const { boundToOf } = await import(
  "$capabilities/resource-sets/api/shared/validation"
);

const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
  ...fields,
  _id: `${table}:${id}`,
  _creationTime: 1
});

const namedSet = (id: string, fields: Record<string, unknown> = {}): Row =>
  row("resourceSets", id, {
    projectId: "projects:p",
    name: `Set ${id}`,
    set: { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] },
    createdBy: { kind: "user", userId: "users:u" },
    revision: 1,
    updatedAt: 5,
    ...fields
  });

const authoredResource = (
  table: "documents" | "presentations" | "spreadsheets",
  id: string,
  projectId = "projects:p"
): Row => row(table, id, {
  projectId,
  title: `${table} ${id}`,
  createdBy: { kind: "system" },
  updatedBy: { kind: "system" },
  updatedAt: 1
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.scope = { projectId: "projects:p", userId: "users:u", username: "Uma" };
  model.tables = {
    users: [{
      _id: "users:u",
      _creationTime: 1,
      authSubject: "auth:u",
      displayName: "Uma",
      settings: "{}",
      updatedAt: 1
    }],
    memberships: [row("memberships", "1", {
      userId: "users:u",
      projectId: "projects:p",
      token: "u",
      role: "owner"
    })],
    resourceSets: [],
    templates: [],
    templateStages: [],
    documents: [
      { ...authoredResource("documents", "1"), title: "Brief" },
      { ...authoredResource("documents", "2"), title: "Staged" },
      { ...authoredResource("documents", "3", "projects:other"), title: "Elsewhere" }
    ],
    presentations: [{ ...authoredResource("presentations", "1"), title: "Presentation" }],
    spreadsheets: [],
    findings: [row("findings", "1", {
      projectId: "projects:p",
      title: "Relay",
      body: [],
      sources: [],
      evidenceFor: [],
      relatedTo: [],
      researchThreadIds: [],
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    })],
    researchThreads: []
  };
});

describe("reading the project's sets", () => {
  test("projects only this project's sets, sorted by name, with a live count", async () => {
    model.tables.resourceSets.push(
      namedSet("2", { name: "Zulu", set: { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["presentation"] }] } }),
      namedSet("1", { name: "Alpha" }),
      namedSet("3", { name: "Foreign", projectId: "projects:other" })
    );
    model.tables.templateStages.push(row("templateStages", "1", {
      projectId: "projects:p",
      templateId: "templates:stage-owner",
      templateRevision: 1,
      target: "document",
      resourceId: "documents:2",
      createdBy: { kind: "system" },
      updatedAt: 1
    }));

    const answer = await readResourceSets();

    assert.deepEqual(
      answer.sets.map((set) => [set.id, set.name, set.resolves, set.createdByName]),
      [
        ["resourceSets:1", "Alpha", 1, "Uma"],
        ["resourceSets:2", "Zulu", 2, "Uma"]
      ]
    );
    assert.deepEqual(answer.unavailable, []);
  });

  test("fails closed on a malformed row", async () => {
    model.tables.resourceSets.push(namedSet("1"), namedSet("2", { set: { include: "everything" } }));

    await assert.rejects(() => readResourceSets(), /non-current field values/);
  });

  test("never resolves a reusable set through an unnamed private row", async () => {
    model.tables.resourceSets.push(
      namedSet("1", {
        set: { include: [{ select: "set", setId: "resourceSets:2" }], exclude: [] }
      }),
      row("resourceSets", "2", {
        projectId: "projects:p",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:1" },
          hole: "evidence"
        },
        set: { include: [{ select: "project" }], exclude: [] },
        createdBy: { kind: "user", userId: "users:u" },
        revision: 1,
        updatedAt: 5
      })
    );

    const answer = await readResourceSets();

    assert.deepEqual(answer.sets.map((set) => [set.id, set.resolves]), [
      ["resourceSets:1", 0]
    ]);
  });
});

describe("changing sets", () => {
  test("creates a set in the scoped project from a validated input", async () => {
    const answer = await createResourceSet({
      name: " Field evidence ",
      set: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
    });

    assert.deepEqual(answer, { accepted: true, setId: "resourceSets:1", revision: 1 });
    assert.deepEqual(model.tables.resourceSets[0], {
      _id: "resourceSets:1",
      _creationTime: 1,
      projectId: "projects:p",
      name: "Field evidence",
      set: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] },
      createdBy: { kind: "user", userId: "users:u" },
      revision: 1,
      updatedAt: 500
    });
  });

  test("refuses an input it cannot act on before reading the store", async () => {
    await assert.rejects(() => createResourceSet({ name: "", set: { include: [], exclude: [] } }), /name is required/);
    await assert.rejects(
      () => createResourceSet({ name: "x", set: { include: [{ select: "everything" }], exclude: [] } }),
      /selects project, kinds, resources, or set/
    );
    await assert.rejects(() => updateResourceSet({ setId: "resourceSets:1", baseRevision: 1, patch: {} }), /at least one field/);
  });

  test("rejects non-data command shapes and never invokes their accessors", async () => {
    const current = {
      name: "Field evidence",
      set: { include: [{ select: "project" }], exclude: [] }
    };
    const inherited = Object.assign(Object.create({ retired: true }), current);
    await assert.rejects(() => createResourceSet(inherited), /exact current data object/);

    const symbolic = { ...current } as Record<PropertyKey, unknown>;
    symbolic[Symbol("retired")] = true;
    await assert.rejects(() => createResourceSet(symbolic as never), /exact current data object/);

    const hidden = { ...current };
    Object.defineProperty(hidden, "retired", { value: true, enumerable: false });
    await assert.rejects(() => createResourceSet(hidden), /exact current data object/);

    let reads = 0;
    const accessor = { name: "Field evidence" } as Record<string, unknown>;
    Object.defineProperty(accessor, "set", {
      enumerable: true,
      get: () => {
        reads += 1;
        return current.set;
      }
    });
    await assert.rejects(() => createResourceSet(accessor as never), /exact current data object/);
    assert.equal(reads, 0);

    await assert.rejects(
      () => createResourceSet({ ...current, description: undefined } as never),
      /exact current data object/
    );

    const decoratedInclude = [{ select: "project" }];
    Object.defineProperty(decoratedInclude, "retired", { value: true, enumerable: false });
    await assert.rejects(
      () => createResourceSet({
        ...current,
        set: { include: decoratedInclude, exclude: [] }
      } as never),
      /exact current data object/
    );
  });

  test("requires exact nominal current identities for private owners", () => {
    assert.deepEqual(
      boundToOf({ kind: "hole", templateId: "templates:1", hole: "evidence" }, "test"),
      { kind: "hole", templateId: "templates:1", hole: "evidence" }
    );
    assert.throws(
      () => boundToOf({ kind: "hole", templateId: "documents:1", hole: "evidence" }, "test"),
      /names a template/
    );
    assert.deepEqual(
      boundToOf({
        kind: "resource",
        ref: { kind: "document", id: "documents:1" },
        hole: "evidence"
      }, "test"),
      {
        kind: "resource",
        ref: { kind: "document", id: "documents:1" },
        hole: "evidence"
      }
    );
    assert.throws(
      () => boundToOf({
        kind: "resource",
        resourceId: "documents:1",
        hole: "evidence"
      }, "test"),
      /one resource and a hole/
    );
    assert.throws(
      () => boundToOf({
        kind: "resource",
        ref: { kind: "presentation", id: "documents:1" },
        hole: "evidence"
      }, "test"),
      /matching row id/
    );
  });

  test("rejects retired selectors and every non-current resource reference shape", async () => {
    const invalid = [
      { include: [{ select: "kinds", kinds: ["analysis"] }], exclude: [] },
      {
        include: [{
          select: "resources",
          refs: [{ kind: "externalFile", id: "externalFiles:1" }]
        }],
        exclude: []
      },
      {
        include: [{
          select: "resources",
          refs: [{ kind: "externalFile::pdf", id: "externalFiles:1" }]
        }],
        exclude: []
      },
      {
        include: [{
          select: "resources",
          refs: [{ kind: "document", id: "presentations:1" }]
        }],
        exclude: []
      },
      {
        include: [{
          select: "resources",
          refs: [{ kind: "document", id: "documents:1", title: "Brief" }]
        }],
        exclude: []
      }
    ];

    for (const [index, set] of invalid.entries()) {
      await assert.rejects(
        () => createResourceSet({ name: `Unsafe ${index}`, set } as never),
        /resource kinds|resource references/
      );
    }
    assert.deepEqual(model.tables.resourceSets, []);
  });

  test("updates with a revision check and refuses a stale or self-including patch", async () => {
    model.tables.resourceSets.push(namedSet("1"));

    const stale = await updateResourceSet({ setId: "resourceSets:1", baseRevision: 3, patch: { name: "Late" } });
    assert.deepEqual(stale, {
      accepted: false,
      setId: "resourceSets:1",
      reason: "stale",
      revision: 1,
      detail: "authored against revision 3, the set is at 1"
    });

    const loop = await updateResourceSet({
      setId: "resourceSets:1",
      baseRevision: 1,
      patch: { set: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }
    });
    assert.equal(loop.accepted, false);

    const renamed = await updateResourceSet({
      setId: "resourceSets:1",
      baseRevision: 1,
      patch: { name: "Renamed", description: "Now described" }
    });
    assert.deepEqual(renamed, { accepted: true, setId: "resourceSets:1", revision: 2 });
    assert.equal(model.tables.resourceSets[0].name, "Renamed");
    assert.equal(model.tables.resourceSets[0].description, "Now described");
    assert.equal(model.tables.resourceSets[0].revision, 2);
  });

  test("refuses missing, private, cross-project, and recursively cyclic set references", async () => {
    model.tables.resourceSets.push(
      namedSet("1"),
      row("resourceSets", "2", {
        projectId: "projects:p",
        boundTo: {
          kind: "resource",
          ref: { kind: "document", id: "documents:1" },
          hole: "evidence"
        },
        set: { include: [{ select: "project" }], exclude: [] },
        createdBy: { kind: "user", userId: "users:u" },
        revision: 1,
        updatedAt: 5
      }),
      namedSet("3", { projectId: "projects:other" }),
      namedSet("4", {
        set: { include: [{ select: "set", setId: "resourceSets:2" }], exclude: [] }
      }),
      namedSet("5", {
        set: { include: [{ select: "set", setId: "resourceSets:6" }], exclude: [] }
      }),
      namedSet("6", {
        set: { include: [{ select: "set", setId: "resourceSets:5" }], exclude: [] }
      }),
      namedSet("7", {
        set: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      })
    );
    const pointingAt = (setId: string) => ({
      name: "Unsafe",
      set: { include: [{ select: "set", setId }], exclude: [] }
    });

    for (const setId of [
      "resourceSets:missing",
      "resourceSets:2",
      "resourceSets:3",
      "resourceSets:4",
      "resourceSets:5"
    ]) {
      const result = await createResourceSet(pointingAt(setId));
      assert.equal(result.accepted, false);
      assert.equal(result.accepted ? "" : result.reason, "invalid-reference");
    }

    const recursive = await updateResourceSet({
      setId: "resourceSets:1",
      baseRevision: 1,
      patch: {
        set: { include: [{ select: "set", setId: "resourceSets:7" }], exclude: [] }
      }
    });
    assert.equal(recursive.accepted, false);
    assert.equal(recursive.accepted ? "" : recursive.reason, "invalid-reference");
    assert.match(recursive.accepted ? "" : recursive.detail, /cycle/);
    assert.equal(model.tables.resourceSets[0].revision, 1);
  });

  test("refuses to remove a set another set or a template default still names", async () => {
    model.tables.resourceSets.push(
      namedSet("1"),
      namedSet("2", { set: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } })
    );

    const held = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.deepEqual(held, {
      accepted: false,
      setId: "resourceSets:1",
      reason: "in-use",
      revision: 1,
      detail: 'the set "Set 2" still names it'
    });

    model.tables.resourceSets.splice(1, 1);
    model.tables.templates.push(
      row("templates", "1", {
        projectId: "projects:p",
        userId: "users:u",
        name: "Brief",
        tags: [],
        body: { resource: "document", rows: [] },
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
          }
        ],
        createdBy: { kind: "system" },
        revision: 1,
        updatedAt: 1
      })
    );
    const named = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.equal(named.accepted === false && named.detail, 'the template "Brief" still names it');

    model.tables.templates.splice(0, 1);
    const gone = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.deepEqual(gone, { accepted: true, setId: "resourceSets:1", revision: 1 });
    assert.deepEqual(model.tables.resourceSets, []);
  });

  /**
   * A set is deleted only when nothing will ask for it again.
   *
   * A live prompt is the case that bites: the output would keep naming a set
   * that no longer resolves, and the failure would surface on some later
   * refresh rather than on the deletion that caused it.
   */
  test("refuses to remove a set a generated output or a Prompt Block still reads", async () => {
    model.tables.resourceSets.push(namedSet("1"));
    model.tables.derivedOutputs = [
      row("derivedOutputs", "1", {
        projectId: "projects:p",
        prompt: "  Summarise   what winter changed  ",
        definitionRevision: 1,
        valueSource: "none",
        scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] },
        queries: [],
        evidence: [],
        state: "idle",
        createdBy: { kind: "system" },
        updatedAt: 1
      })
    ];

    const reading = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.deepEqual(reading, {
      accepted: false,
      setId: "resourceSets:1",
      reason: "in-use",
      revision: 1,
      detail: 'a prompt still reads it: "Summarise what winter changed"'
    });

    model.tables.derivedOutputs = [];
    model.tables.documentSnapshots = [
      row("documentSnapshots", "1", {
        projectId: "projects:p",
        resourceId: "documents:1",
        role: "leader",
        revision: 3,
        part: 0,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                {
                  id: "b1",
                  type: "prompt",
                  scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] },
                  prompt: "Summarise",
                  atoms: [],
                  display: "",
                  marks: [],
                  state: "idle"
                }
              ]
            }
          ]
        },
        at: 1
      })
    ];

    const blocked = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.equal(
      blocked.accepted === false && blocked.detail,
      'a Prompt Block in "Brief" still reads it'
    );

    model.tables.documentSnapshots[0].role = "checkpoint";
    const gone = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.deepEqual(gone, { accepted: true, setId: "resourceSets:1", revision: 1 });
  });

  test("does not reach a set in another project", async () => {
    model.tables.resourceSets.push(namedSet("1", { projectId: "projects:other" }));

    const answer = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted === false && answer.reason, "not-found");
    assert.equal(model.tables.resourceSets.length, 1);
  });

  test("cannot update or remove a resource-owned private set", async () => {
    const privateSet = row("resourceSets", "private", {
      projectId: "projects:p",
      boundTo: {
        kind: "resource",
        ref: { kind: "document", id: "documents:1" },
        hole: "evidence"
      },
      set: { include: [{ select: "resources", refs: [{ kind: "document", id: "documents:1" }] }], exclude: [] },
      createdBy: { kind: "user", userId: "users:u" },
      revision: 7,
      updatedAt: 5
    });
    model.tables.resourceSets.push(privateSet);

    const updated = await updateResourceSet({
      setId: "resourceSets:private",
      baseRevision: 7,
      patch: { name: "Stolen" }
    });
    const removed = await removeResourceSet({
      setId: "resourceSets:private",
      baseRevision: 7
    });

    assert.deepEqual(updated, {
      accepted: false,
      setId: "resourceSets:private",
      reason: "not-found",
      revision: null,
      detail: "no set in this project has that id"
    });
    assert.deepEqual(removed, {
      accepted: false,
      setId: "resourceSets:private",
      reason: "not-found",
      revision: null,
      detail: "no set in this project has that id"
    });
    assert.deepEqual(model.tables.resourceSets, [privateSet]);
  });

  test("refuses a malformed named row before dependency scanning or deletion", async () => {
    const malformed = namedSet("broken", {
      set: { include: "everything", exclude: [] }
    });
    model.tables.resourceSets.push(malformed);
    const before = structuredClone(model.tables);
    const reads = vi.spyOn(model.store, "read");

    await assert.rejects(
      () => removeResourceSet({ setId: "resourceSets:broken", baseRevision: 1 }),
      /non-current field values/
    );
    assert.deepEqual(model.tables, before);
    assert.deepEqual(reads.mock.calls.map(([path]) => path), ["resourceSets"]);
    reads.mockRestore();
  });
});
