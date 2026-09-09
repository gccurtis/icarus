import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const model = vi.hoisted(() => ({
  scope: { projectId: "p", userId: "u", username: "Uma" },
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

const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
  ...fields,
  _id: `${table}:${id}`,
  _creationTime: 1
});

const namedSet = (id: string, fields: Record<string, unknown> = {}): Row =>
  row("resourceSets", id, {
    projectId: "p",
    name: `Set ${id}`,
    set: { include: [{ select: "kinds", kinds: ["document"] }], exclude: [] },
    createdBy: { kind: "user", userId: "u" },
    revision: 1,
    updatedAt: 5,
    ...fields
  });

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.scope = { projectId: "p", userId: "u", username: "Uma" };
  model.tables = {
    users: [{ _id: "u", _creationTime: 1, displayName: "Uma" }],
    memberships: [row("memberships", "1", { userId: "u", projectId: "p", token: "u", role: "owner" })],
    resourceSets: [],
    templates: [],
    templateStages: [],
    documents: [
      row("documents", "1", { projectId: "p", title: "Brief" }),
      row("documents", "2", { projectId: "p", title: "Staged" }),
      row("documents", "3", { projectId: "other", title: "Elsewhere" })
    ],
    slideDecks: [row("slideDecks", "1", { projectId: "p", title: "Deck" })],
    spreadsheets: [],
    findings: [row("findings", "1", { projectId: "p", title: "Relay" })],
    researchThreads: []
  };
});

describe("reading the project's sets", () => {
  test("projects only this project's sets, sorted by name, with a live count", async () => {
    model.tables.resourceSets.push(
      namedSet("2", { name: "Zulu", set: { include: [{ select: "project" }], exclude: [{ select: "kinds", kinds: ["slides"] }] } }),
      namedSet("1", { name: "Alpha" }),
      namedSet("3", { name: "Foreign", projectId: "other" })
    );
    model.tables.templateStages.push(row("templateStages", "1", { projectId: "p", resourceId: "documents:2" }));

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

  test("quarantines a malformed row without hiding the rest", async () => {
    model.tables.resourceSets.push(namedSet("1"), namedSet("2", { set: { include: "everything" } }));

    const answer = await readResourceSets();

    assert.deepEqual(answer.sets.map((set) => set.id), ["resourceSets:1"]);
    assert.equal(answer.unavailable.length, 1);
    assert.match(answer.unavailable[0].detail, /include list/);
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
      projectId: "p",
      name: "Field evidence",
      set: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] },
      createdBy: { kind: "user", userId: "u" },
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
        projectId: "p",
        name: "Brief",
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
          }
        ]
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
        projectId: "p",
        prompt: "  Summarise   what winter changed  ",
        scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
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
        projectId: "p",
        resourceId: "documents:1",
        role: "leader",
        revision: 3,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                {
                  id: "b1",
                  type: "prompt",
                  scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
                }
              ]
            }
          ]
        }
      })
    ];

    const blocked = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.equal(
      blocked.accepted === false && blocked.detail,
      'a Prompt Block in "Brief" still reads it'
    );

    model.tables.documentSnapshots[0].role = "follower";
    const gone = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.deepEqual(gone, { accepted: true, setId: "resourceSets:1", revision: 1 });
  });

  test("does not reach a set in another project", async () => {
    model.tables.resourceSets.push(namedSet("1", { projectId: "other" }));

    const answer = await removeResourceSet({ setId: "resourceSets:1", baseRevision: 1 });
    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted === false && answer.reason, "not-found");
    assert.equal(model.tables.resourceSets.length, 1);
  });
});
