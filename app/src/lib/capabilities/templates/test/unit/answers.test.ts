import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { RowFields } from "$capabilities/templates/api/shared/store";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const model = vi.hoisted(() => ({
  scope: { projectId: "projects:1", userId: "users:1", username: "Uma" },
  tables: {} as Record<string, Row[]>,
  store: {
    create: (table: string, fields: unknown) => {
      const rows = (model.tables[table] ??= []);
      const id = `${table}:${rows.length + 1}`;
      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: 1 });
      return id;
    },
    createMany: (table: string, fields: readonly unknown[]) =>
      fields.map((entry) => model.store.create(table, entry)),
    read: (path: string) => {
      const [table] = path.split(".");
      return { table, kind: "table", rows: model.tables[table] ?? [] };
    },
    update: (path: string, value: unknown) => {
      const [table, id, ...fields] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      rows[index] =
        fields.length === 0
          ? { ...(value as Record<string, unknown>), _id: id, _creationTime: rows[index]._creationTime }
          : { ...rows[index], [fields[0]]: value };
    },
    remove: (path: string) => {
      const [table, id] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index >= 0) rows.splice(index, 1);
    },
    removeRows: () => {},
    removeFieldFromRows: () => {},
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T => {
      const before = structuredClone(model.tables);
      try {
        return work(model.store as unknown as StoreUnitOfWork);
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

const { createTemplateFromResource } = await import(
  "$capabilities/templates/api/create-template-from-resource/create-template-from-resource"
);
const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);
const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);
const { writeTemplateVersion } = await import(
  "$capabilities/templates/api/shared/template-rows"
);

const prompt = (id: string, name: string) => ({
  id,
  type: "prompt",
  atoms: [{ id: `${id}-a`, kind: "literal", text: "Sum up" }],
  display: "Sum up",
  prompt: "Sum up",
  marks: [],
  scope: { include: [{ select: "hole", name }], exclude: [] },
  state: "idle"
});

const body = {
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks: [prompt("p1", "evidence")] }]
};

const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
  ...fields,
  _id: `${table}:${id}`,
  _creationTime: 1
});

const scopeOf = (held: Row) => {
  const rows = (held.body as {
    rows: { blocks: { derivedOutputId?: string; scope?: unknown }[] }[];
  }).rows;
  const block = rows[0].blocks[0];
  if (block.derivedOutputId === undefined) return block.scope;
  return (model.tables.derivedOutputs ?? []).find(
    (output) => output._id === block.derivedOutputId
  )?.scope;
};

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.scope = { projectId: "projects:1", userId: "users:1", username: "Uma" };
  model.tables = {
    users: [{
      _id: "users:1",
      _creationTime: 1,
      authSubject: "auth:uma",
      displayName: "Uma",
      settings: "{}",
      updatedAt: 1
    }],
    memberships: [row("memberships", "1", { userId: "users:1", projectId: "projects:1", token: "u", role: "owner" })],
    templates: [
      row("templates", "1", {
        projectId: "projects:1",
        userId: "users:1",
        name: "Brief",
        tags: [],
        body,
        holes: [{ name: "evidence", label: "Evidence", kind: "scope", default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } }],
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 20
      })
    ],
    templateVersions: [],
    templateStages: [],
    resourceSets: [row("resourceSets", "1", { projectId: "projects:1", name: "Field evidence", set: { include: [{ select: "project" }], exclude: [] }, createdBy: { kind: "user", userId: "users:1" }, revision: 1, updatedAt: 1 })],
    documents: [],
    documentSnapshots: [],
    slideDecks: [],
    slideDeckSnapshots: [],
    spreadsheets: []
  };
});

describe("instantiating with answers", () => {
  test("refuses answers that do not name a declared hole of the matching kind", async () => {
    const extraScope = await instantiateTemplate({
      templateId: "templates:1",
      answers: { missing: { include: [{ select: "project" }], exclude: [] } }
    });
    const textForScope = await instantiateTemplate({
      templateId: "templates:1",
      texts: { evidence: "Wrong kind" }
    });
    const extraText = await instantiateTemplate({
      templateId: "templates:1",
      texts: { missing: "No such hole" }
    });

    for (const refused of [extraScope, textForScope, extraText]) {
      assert.equal(refused.accepted, false);
      assert.match(refused.accepted ? "" : refused.detail, /do not match declared holes/);
    }
    assert.equal(model.tables.documents.length, 0);

    model.tables.templates[0].body = {
      resource: "document",
      rows: [
        {
          id: "row",
          kind: "blocks",
          blocks: [
            {
              id: "text",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "atom", kind: "template", name: "title" }],
              display: "{title}",
              marks: []
            }
          ]
        }
      ]
    };
    model.tables.templates[0].holes = [
      { name: "title", label: "Title", kind: "text", text: "Default" }
    ];
    const scopeForText = await instantiateTemplate({
      templateId: "templates:1",
      answers: { title: { include: [{ select: "project" }], exclude: [] } }
    });
    assert.equal(scopeForText.accepted, false);
    assert.match(scopeForText.accepted ? "" : scopeForText.detail, /do not match declared holes/);
    assert.equal(model.tables.documents.length, 0);
  });

  test("fills the scope from the caller, else the default", async () => {
    const byDefault = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(byDefault.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "kinds", kinds: ["finding"] }],
      exclude: []
    });

    const byCaller = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] } }
    });
    assert.ok(byCaller.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[1]), {
      include: [{ select: "set", setId: "resourceSets:1" }],
      exclude: []
    });
  });

  test("a default may name one of the project's sets", async () => {
    model.tables.templates[0].holes = [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      }
    ];
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.equal(made.accepted, true);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "set", setId: "resourceSets:1" }],
      exclude: []
    });
  });

  test("placement refuses malformed and globally duplicated named Resource Sets", async () => {
    const reusable = structuredClone(model.tables.resourceSets[0]);
    const place = () => instantiateTemplate({
      templateId: "templates:1",
      answers: {
        evidence: {
          include: [{ select: "set", setId: "resourceSets:1" }],
          exclude: []
        }
      }
    });

    model.tables.resourceSets = [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Foreign duplicate" }
    ];
    const duplicate = await place();
    assert.equal(duplicate.accepted, false);
    assert.match(duplicate.accepted ? "" : duplicate.detail, /named reusable|private/);

    model.tables.resourceSets = [
      { ...reusable, set: { include: "everything", exclude: [] } }
    ];
    const malformed = await place();
    assert.equal(malformed.accepted, false);
    assert.match(malformed.accepted ? "" : malformed.detail, /named reusable|private/);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.documentSnapshots, []);
  });

  test("a stored default cannot retain a malformed or globally duplicated named set", async () => {
    model.tables.templates[0].holes = [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: {
          include: [{ select: "set", setId: "resourceSets:1" }],
          exclude: []
        }
      }
    ];
    const reusable = structuredClone(model.tables.resourceSets[0]);

    model.tables.resourceSets = [
      reusable,
      { ...reusable, projectId: "projects:other", name: "Foreign duplicate" }
    ];
    const duplicate = await instantiateTemplate({ templateId: "templates:1" });
    assert.equal(duplicate.accepted, false);
    assert.match(duplicate.accepted ? "" : duplicate.detail, /resourceSets:1/);

    model.tables.resourceSets = [
      { ...reusable, createdBy: { kind: "user" } }
    ];
    const malformed = await instantiateTemplate({ templateId: "templates:1" });
    assert.equal(malformed.accepted, false);
    assert.match(malformed.accepted ? "" : malformed.detail, /resourceSets:1/);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.documentSnapshots, []);
  });

  /**
   * A copy is the project's material from the moment it lands.
   *
   * Nothing else edits it, so without this the words are invisible to every
   * agent until somebody happens to type in it or a backfill is run by hand.
   */
  test("enqueues the copy for retrieval", async () => {
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(made.accepted);
    assert.deepEqual(
      (model.tables.semanticSyncJobs ?? []).map((row) => row.ref),
      [{ kind: "document", id: made.resourceId }]
    );
  });

  /**
   * A copy's prompts point back at the copy, in the vocabulary everything else
   * speaks. A deck is `slides` — the name the editors, the overlay and every
   * scope term already use.
   */
  test("gives a placed deck's prompts a derived output with a slides origin", async () => {
    model.tables.templates.push(
      row("templates", "2", {
        projectId: "projects:1",
        userId: "users:1",
        name: "Deck",
        tags: [],
        body: {
          resource: "slides",
          aspectRatio: "16:9",
          theme: { colors: { text: "ink", accent: "blue", muted: "gray" } },
          styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
          layouts: [],
          slides: [
            {
              id: "slide-1",
              elements: [
                {
                  id: "element-1",
                  frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
                  overflow: "shrink",
                  content: {
                    type: "prompt",
                    block: {
                      id: "deck-prompt",
                      type: "prompt",
                      atoms: [{ id: "deck-prompt-a", kind: "literal", text: "" }],
                      display: "",
                      marks: [],
                      state: "idle",
                      prompt: "What shipped this winter?"
                    }
                  }
                }
              ],
              notes: []
            }
          ],
          sections: []
        },
        holes: [],
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 20
      })
    );

    const made = await instantiateTemplate({ templateId: "templates:2" });
    assert.ok(made.accepted);
    const outputs = model.tables.derivedOutputs ?? [];
    assert.equal(outputs.length, 1);
    assert.deepEqual(outputs[0].origin, { kind: "slides", id: made.resourceId });
    assert.equal(outputs[0].prompt, "What shipped this winter?");
  });

  test("a hole without a default means the whole project", async () => {
    model.tables.templates[0].holes = [{ name: "evidence", label: "Evidence", kind: "scope" }];
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(made.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "project" }],
      exclude: []
    });
  });

  test("a private default cannot transitively retain another owner's private row", async () => {
    model.tables.resourceSets.push(
      row("resourceSets", "2", {
        projectId: "projects:1",
        boundTo: { kind: "hole", templateId: "templates:1", hole: "evidence" },
        set: {
          include: [{ select: "set", setId: "resourceSets:3" }],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      }),
      row("resourceSets", "3", {
        projectId: "projects:1",
        boundTo: { kind: "resource", resourceId: "documents:3", hole: "evidence" },
        set: { include: [{ select: "project" }], exclude: [] },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    model.tables.templates[0].holes = [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: "resourceSets:2" }], exclude: [] }
      }
    ];

    const result = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(result.accepted, false);
    assert.match(result.accepted === false ? result.detail : "", /resourceSets:3/);
    assert.deepEqual(model.tables.documents, []);
  });

  test("refuses an answer naming a set the project does not hold, and a body naming an undeclared hole", async () => {
    const unknownSet = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] } }
    });
    assert.equal(unknownSet.accepted, false);
    assert.match(unknownSet.accepted === false ? unknownSet.detail : "", /resourceSets:9/);

    model.tables.resourceSets.push(
      row("resourceSets", "2", {
        projectId: "projects:1",
        boundTo: { kind: "hole", templateId: "templates:1", hole: "evidence" },
        set: { include: [{ select: "project" }], exclude: [] },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    const privateSet = await instantiateTemplate({
      templateId: "templates:1",
      answers: {
        evidence: {
          include: [{ select: "set", setId: "resourceSets:2" }],
          exclude: []
        }
      }
    });
    assert.equal(privateSet.accepted, false);
    assert.match(privateSet.accepted === false ? privateSet.detail : "", /private/);
    assert.deepEqual(model.tables.documents, []);

    model.tables.templates[0].holes = [];
    const undeclared = await instantiateTemplate({ templateId: "templates:1" });
    assert.deepEqual(undeclared, {
      accepted: false,
      templateId: "templates:1",
      reason: "unsupported-body",
      revision: 1,
      detail: "the body names a hole the template does not declare: evidence"
    });
    assert.deepEqual(model.tables.documents, []);
    await assert.rejects(
      () => instantiateTemplate({ templateId: "templates:1", answers: { evidence: { kind: "set" } } }),
      /include list and an exclude list/
    );
  });
});

describe("replacing the hole list", () => {
  test("keeps a hole the body names and accepts a list that declares it", async () => {
    const dropped = await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { holes: [] } });
    assert.deepEqual(dropped, {
      accepted: false,
      templateId: "templates:1",
      reason: "hole-in-use",
      revision: 1,
      detail: "the body still names evidence"
    });

    const kept = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        holes: [
          { name: "evidence", label: "Evidence", kind: "scope", description: "What happened" },
          { name: "models", label: "Models", kind: "scope", default: { include: [{ select: "project" }], exclude: [] } }
        ]
      }
    });
    assert.deepEqual(kept, { accepted: true, templateId: "templates:1", revision: 2 });
    assert.deepEqual(
      (model.tables.templates[0].holes as { name: string }[]).map((hole) => hole.name),
      ["evidence", "models"]
    );
  });
});

describe("a template from a live resource", () => {
  test("makes a portable document template and declares the names its body uses", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 4,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                { ...prompt("p1", "evidence"), derivedOutputId: "derivedOutputs:3" },
                {
                  id: "t1",
                  type: "text",
                  variant: "paragraph",
                  atoms: [{ id: "t1-a", kind: "literal", text: "Read the plan" }],
                  display: "Read the plan",
                  marks: [
                    {
                      id: "m1",
                      from: { atom: "t1-a", offset: 9 },
                      to: { atom: "t1-a", offset: 13 },
                      link: { kind: "url", url: "https://example.com/plan", note: "Scope" }
                    }
                  ]
                }
              ]
            }
          ]
        }
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Winter brief shell",
      tags: ["Winter"]
    });
    assert.deepEqual(made, {
      accepted: true,
      templateId: "templates:2",
      target: "document",
      revision: 1,
      dropped: ["Dropped a prompt's link to its generated output."]
    });
    const held = model.tables.templates[1];
    assert.equal(held.name, "Winter brief shell");
    assert.deepEqual(held.tags, ["Winter"]);
    assert.deepEqual(held.holes, [{ name: "evidence", label: "evidence", kind: "scope" }]);
    const kept = (held.body as { rows: { blocks: { marks: { link: unknown }[] }[] }[] }).rows[0]
      .blocks[1].marks[0].link;
    assert.deepEqual(kept, { kind: "url", url: "https://example.com/plan", note: "Scope" });
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  /**
   * Marking a run says where a hole goes. It does not put one there.
   *
   * The template gets the hole and the resource keeps its words, its
   * formatting and its display exactly as they were, which is the whole reason
   * a hole over text is a mark rather than an edit.
   */
  test("turns a marked run into a hole on the template and leaves the document alone", async () => {
    const live = {
      rows: [
        {
          id: "r1",
          kind: "blocks",
          blocks: [
            {
              id: "t1",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "t1-a", kind: "literal", text: "Dear Northwind, about winter." }],
              display: "Dear Northwind, about winter.",
              marks: [
                {
                  id: "m1",
                  from: { atom: "t1-a", offset: 5 },
                  to: { atom: "t1-a", offset: 14 },
                  hole: { name: "client", description: "Who it is for" }
                },
                { id: "m2", from: { atom: "t1-a", offset: 22 }, to: { atom: "t1-a", offset: 28 }, style: ["bold"] },
                { id: "m3", from: { atom: "t1-a", offset: 0 }, to: { atom: "t1-a", offset: 9 }, style: ["italic"] }
              ]
            }
          ]
        }
      ]
    };
    const untouched = structuredClone(live);
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter note" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 2,
        body: live
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Winter note shell",
      tags: []
    });
    assert.equal(made.accepted, true);

    const held = model.tables.templates[1];
    assert.deepEqual(held.holes, [
      { name: "client", label: "client", kind: "text", description: "Who it is for", text: "Northwind" }
    ]);
    const block = (held.body as { rows: { blocks: Record<string, unknown>[] }[] }).rows[0].blocks[0];
    assert.equal(block.display, "Dear {client}, about winter.");
    assert.equal((block.marks as unknown[]).length, 1);
    assert.deepEqual((block.marks as { style: string[] }[])[0].style, ["bold"]);

    assert.deepEqual(model.tables.documentSnapshots[0].body, untouched);
  });

  /**
   * A hole is made, never found.
   *
   * A prompt nobody templateified keeps the scope it reads and produces no
   * hole, so placing the template asks nothing about it. That is what keeps
   * the questions to the ones somebody meant to ask.
   */
  test("gives no hole to a prompt nobody templateified", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 1,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                {
                  id: "p1",
                  type: "prompt",
                  atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
                  display: "Sum up",
                  prompt: "Sum up",
                  marks: [],
                  scope: { include: [{ select: "project" }], exclude: [] },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Authored prompt"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    assert.deepEqual(held.holes, []);
    assert.deepEqual(scopeOf(held), { include: [{ select: "project" }], exclude: [] });
  });

  /**
   * A linked prompt's scope belongs to its output, and the template takes it
   * from there — the same moment, and for the same reason, as the question.
   *
   * The block is given a stale scope here on purpose: it is what an older
   * revision would have left behind, and the output has to win.
   */
  test("takes a linked prompt's scope off the output, not off the block", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.derivedOutputs = [
      row("derivedOutputs", "3", {
        projectId: "projects:1",
        prompt: "What broke?",
        scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      })
    ];
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 2,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                {
                  id: "p1",
                  type: "prompt",
                  atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
                  display: "Sum up",
                  prompt: "Sum up",
                  marks: [],
                  derivedOutputId: "derivedOutputs:3",
                  scope: { include: [{ select: "kinds", kinds: ["research"] }], exclude: [] },
                  hole: { name: "winter" },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Winter shell"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    assert.deepEqual(held.holes, [
      {
        name: "winter",
        label: "winter",
        kind: "scope",
        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      }
    ]);
    assert.deepEqual(scopeOf(held), { include: [{ select: "hole", name: "winter" }], exclude: [] });
  });

  test("re-owns a linked prompt's private scope instead of retaining the source resource row", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.resourceSets.push(
      row("resourceSets", "2", {
        projectId: "projects:1",
        boundTo: { kind: "resource", resourceId: "documents:9", hole: "winter" },
        set: {
          include: [
            { select: "resources", refs: [{ kind: "document", id: "documents:2" }] }
          ],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    model.tables.derivedOutputs = [
      row("derivedOutputs", "3", {
        projectId: "projects:1",
        prompt: "What broke?",
        scope: { include: [{ select: "set", setId: "resourceSets:2" }], exclude: [] }
      })
    ];
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 2,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                {
                  id: "p1",
                  type: "prompt",
                  atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
                  display: "Sum up",
                  marks: [],
                  derivedOutputId: "derivedOutputs:3",
                  hole: { name: "winter" },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    const refused = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Borrowed shell"
    });
    assert.equal(refused.accepted, false);
    assert.match(refused.accepted ? "" : refused.detail, /private/);
    assert.equal(model.tables.templates.length, 1);

    model.tables.resourceSets[1].boundTo = {
      kind: "resource",
      resourceId: "documents:1",
      hole: "winter"
    };
    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Winter shell"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    const defaultScope = (held.holes as { default: { include: { setId?: string }[] } }[])[0]
      .default;
    const setId = defaultScope.include[0].setId;
    assert.notEqual(setId, "resourceSets:2");
    const owned = model.tables.resourceSets.find((set) => set._id === setId);
    assert.deepEqual(owned?.boundTo, {
      kind: "hole",
      templateId: held._id,
      hole: "winter"
    });
    assert.deepEqual(owned?.set, model.tables.resourceSets.find((set) => set._id === "resourceSets:2")?.set);
    assert.deepEqual((model.tables.templateVersions[0].holes as { default: unknown }[])[0].default, owned?.set);

    model.store.update("resourceSets.resourceSets:2.set", {
      include: [{ select: "project" }],
      exclude: []
    });
    assert.deepEqual(owned?.set, {
      include: [
        { select: "resources", refs: [{ kind: "document", id: "documents:2" }] }
      ],
      exclude: []
    });
  });

  test("keeps whatever the templateified prompt reads as its hole's default", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "projects:1", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "documents:1",
        role: "leader",
        revision: 1,
        body: {
          rows: [
            {
              id: "r1",
              kind: "blocks",
              blocks: [
                {
                  id: "p1",
                  type: "prompt",
                  atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
                  display: "Sum up",
                  prompt: "Sum up",
                  marks: [],
                  hole: { name: "evidence", description: "What happened" },
                  scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] },
                  state: "idle"
                }
              ]
            }
          ]
        }
      })
    );

    const made = await createTemplateFromResource({
      target: "document",
      resourceId: "documents:1",
      name: "Named prompt"
    });
    assert.ok(made.accepted);
    const held = model.tables.templates[1];
    assert.deepEqual(held.holes, [
      {
        name: "evidence",
        label: "evidence",
        kind: "scope",
        description: "What happened",
        default: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      }
    ]);
    assert.deepEqual(scopeOf(held), { include: [{ select: "hole", name: "evidence" }], exclude: [] });
  });

  test("makes a deck template from the whole deck or from one of its slides", async () => {
    model.tables.slideDecks.push(row("slideDecks", "1", { projectId: "projects:1", title: "Board" }));
    model.tables.slideDeckSnapshots.push(
      row("slideDeckSnapshots", "1", {
        projectId: "projects:1",
        resourceId: "slideDecks:1",
        role: "leader",
        revision: 1,
        body: {
          aspectRatio: "16:9",
          theme: { colors: { text: "ink", accent: "blue" } },
          styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
          layouts: [{ id: "l1", key: "title", name: "Title", locked: [], placeholders: [] }],
          slides: [
            { id: "s1", elements: [], notes: [] },
            { id: "s2", layoutKey: "title", elements: [], notes: [] }
          ],
          sections: [{ id: "sec", name: "One", firstSlideId: "s1" }]
        }
      })
    );

    const whole = await createTemplateFromResource({ target: "slides", resourceId: "slideDecks:1", name: "Board" });
    assert.ok(whole.accepted);
    const wholeBody = model.tables.templates[1].body as { resource: string; slides: unknown[]; sections: unknown[] };
    assert.equal(wholeBody.resource, "slides");
    assert.equal(wholeBody.slides.length, 2);
    assert.equal(wholeBody.sections.length, 1);

    const one = await createTemplateFromResource({
      target: "slides",
      resourceId: "slideDecks:1",
      name: "Section divider",
      slideId: "s2"
    });
    assert.ok(one.accepted);
    const held = model.tables.templates[2].body as { resource: string; slides: { id: string }[]; layouts: unknown[]; sections: unknown[] };
    assert.equal(held.resource, "slides");
    assert.deepEqual(held.slides.map((slide) => slide.id), ["s2"]);
    assert.equal(held.layouts.length, 1);
    assert.deepEqual(held.sections, []);

    const missing = await createTemplateFromResource({
      target: "slides",
      resourceId: "slideDecks:1",
      name: "Nothing",
      slideId: "s9"
    });
    assert.equal(missing.accepted === false && missing.reason, "not-found");
    await assert.rejects(
      () => createTemplateFromResource({ target: "document", resourceId: "slideDecks:1", name: "x" }),
      /comes from a document/
    );
    await assert.rejects(
      () => createTemplateFromResource({ target: "document", resourceId: "documents:1", name: "x", slideId: "s1" }),
      /only a deck template names a slide/
    );
  });
});

describe("a rule that cannot be said inline becomes a row", () => {
  const excluding = {
    include: [{ select: "project" }],
    exclude: [{ select: "kinds", kinds: ["slides"] }]
  };

  test("a default that excludes something is stored, and the hole holds one term", async () => {
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { holes: [{ name: "evidence", label: "Evidence", kind: "scope", default: excluding }] }
    });
    assert.ok(result.accepted);

    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
    assert.equal(bound.length, 1);
    assert.deepEqual(bound[0].boundTo, {
      kind: "hole",
      templateId: "templates:1",
      hole: "evidence"
    });
    assert.equal(bound[0].name, undefined);
    assert.deepEqual(bound[0].set, excluding);
    assert.deepEqual(model.tables.templates[0].holes, [
      {
        name: "evidence",
        label: "Evidence",
        kind: "scope",
        default: { include: [{ select: "set", setId: bound[0]._id }], exclude: [] }
      }
    ]);
  });

  test("a rule that can be said inline writes nothing, and clears a row it had", async () => {
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { holes: [{ name: "evidence", label: "Evidence", kind: "scope", default: excluding }] }
    });
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
          }
        ]
      }
    });
    assert.ok(result.accepted);
    assert.equal(model.tables.resourceSets.filter((set) => set.boundTo !== undefined).length, 0);
  });

  test("the same hole rewrites its own row rather than piling them up", async () => {
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { holes: [{ name: "evidence", label: "Evidence", kind: "scope", default: excluding }] }
    });
    const first = model.tables.resourceSets.find((set) => set.boundTo !== undefined);
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: {
              include: [{ select: "project" }],
              exclude: [{ select: "kinds", kinds: ["document"] }]
            }
          }
        ]
      }
    });
    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
    assert.equal(bound.length, 1);
    assert.equal(bound[0]._id, first?._id);
    assert.equal(bound[0].revision, 2);
  });

  test("a default may name particular resources, which a template cannot say itself", async () => {
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: {
              include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
              exclude: []
            }
          }
        ]
      }
    });
    assert.ok(result.accepted);
    const bound = model.tables.resourceSets.find((set) => set.boundTo !== undefined);
    assert.deepEqual(bound?.set, {
      include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
      exclude: []
    });
  });

  test("an answer that excludes something resolves, because it became one term", async () => {
    const placed = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: excluding }
    });
    assert.ok(placed.accepted);
    const bound = model.tables.resourceSets.filter((set) => set.boundTo !== undefined);
    assert.equal(bound.length, 1);
    assert.deepEqual(bound[0].boundTo, {
      kind: "resource",
      resourceId: placed.resourceId,
      hole: "evidence"
    });
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "set", setId: bound[0]._id }],
      exclude: []
    });
  });

  test("a default naming a set from another project is refused", async () => {
    model.tables.resourceSets.push(
      row("resourceSets", "9", {
        projectId: "projects:other",
        name: "Elsewhere",
        set: { include: [], exclude: [] },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] }
          }
        ]
      }
    });
    assert.equal(result.accepted, false);
    assert.equal(result.accepted === false && result.reason, "unsupported-body");
  });

  test("a patch cannot borrow another owner's private resource set", async () => {
    model.tables.resourceSets.push(
      row("resourceSets", "9", {
        projectId: "projects:1",
        boundTo: { kind: "resource", resourceId: "documents:9", hole: "evidence" },
        set: {
          include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:1" },
        revision: 1,
        updatedAt: 1
      })
    );

    const before = structuredClone(model.tables.templates[0]);
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: {
        holes: [
          {
            name: "evidence",
            label: "Evidence",
            kind: "scope",
            default: {
              include: [{ select: "set", setId: "resourceSets:9" }],
              exclude: []
            }
          }
        ]
      }
    });

    assert.equal(result.accepted, false);
    assert.match(result.accepted === false ? result.detail : "", /private/);
    assert.deepEqual(model.tables.templates[0], before);
    assert.deepEqual(model.tables.templateVersions, []);
  });
});

describe("immutable hole defaults in template history", () => {
  const oneDocument = (id: string) => ({
    include: [{ select: "resources" as const, refs: [{ kind: "document" as const, id }] }],
    exclude: []
  });

  test("revision one keeps A after the live hole changes to B and is then removed", async () => {
    model.tables.templates = [];
    model.tables.templateVersions = [];
    model.tables.resourceSets = [];

    const a = oneDocument("documents:A");
    const b = oneDocument("documents:B");
    const base: RowFields<"templates"> = {
      projectId: "projects:1" as never,
      userId: "users:1" as never,
      name: "Evidence shell",
      tags: [],
      body: { resource: "document", rows: [] },
      holes: [],
      createdBy: { kind: "user", userId: "users:1" as never },
      revision: 1,
      updatedAt: 20
    };
    const templateId = model.store.create("templates", base) as never;
    const setId = model.store.create("resourceSets", {
      projectId: "projects:1",
      boundTo: { kind: "hole", templateId, hole: "evidence" },
      set: a,
      createdBy: { kind: "user", userId: "users:1" },
      revision: 1,
      updatedAt: 20
    });
    const revisionOne: RowFields<"templates"> = {
      ...base,
      holes: [
        {
          name: "evidence",
          label: "Evidence",
          kind: "scope",
          default: { include: [{ select: "set", setId: setId as never }], exclude: [] }
        }
      ]
    };
    model.store.update(`templates.${templateId}`, revisionOne);
    writeTemplateVersion(
      model.store as unknown as StoreUnitOfWork,
      templateId,
      revisionOne,
      20
    );

    const changed = await updateTemplate({
      templateId,
      baseRevision: 1,
      patch: {
        holes: [{ name: "evidence", label: "Evidence", kind: "scope", default: b }]
      }
    });
    assert.deepEqual(changed, { accepted: true, templateId, revision: 2 });
    assert.deepEqual(model.tables.templateVersions[0].holes, [
      { name: "evidence", label: "Evidence", kind: "scope", default: a }
    ]);
    assert.deepEqual(model.tables.templateVersions[1].holes, [
      { name: "evidence", label: "Evidence", kind: "scope", default: b }
    ]);

    const removed = await updateTemplate({
      templateId,
      baseRevision: 2,
      patch: { holes: [] }
    });
    assert.deepEqual(removed, { accepted: true, templateId, revision: 3 });
    assert.equal(model.tables.resourceSets.length, 0);
    assert.deepEqual(model.tables.templateVersions.map((version) => version.holes), [
      [{ name: "evidence", label: "Evidence", kind: "scope", default: a }],
      [{ name: "evidence", label: "Evidence", kind: "scope", default: b }],
      []
    ]);
  });
});
