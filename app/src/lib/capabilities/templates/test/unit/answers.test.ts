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
    removeFieldFromRows: () => {}
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

const prompt = (id: string, name: string) => ({
  id,
  type: "prompt",
  atoms: [{ id: `${id}-a`, kind: "literal", text: "Sum up" }],
  display: "Sum up",
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
  const rows = (held.body as { rows: { blocks: { scope: unknown }[] }[] }).rows;
  return rows[0].blocks[0].scope;
};

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.scope = { projectId: "p", userId: "u", username: "Uma" };
  model.tables = {
    users: [{ _id: "u", _creationTime: 1, displayName: "Uma" }],
    memberships: [row("memberships", "1", { userId: "u", projectId: "p", token: "u", role: "owner" })],
    templates: [
      row("templates", "1", {
        projectId: "p",
        userId: "u",
        name: "Brief",
        tags: [],
        body,
        holes: [{ name: "evidence", label: "Evidence", default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] } }],
        createdBy: { kind: "user", userId: "u" },
        revision: 1,
        updatedAt: 20
      })
    ],
    templateVersions: [],
    templateStages: [],
    resourceSets: [row("resourceSets", "1", { projectId: "p", name: "Field evidence", set: { include: [{ select: "project" }], exclude: [] }, createdBy: { kind: "user", userId: "u" }, revision: 1, updatedAt: 1 })],
    documents: [],
    documentSnapshots: [],
    slideDecks: [],
    slideDeckSnapshots: [],
    spreadsheets: []
  };
});

describe("instantiating with answers", () => {
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

  test("a hole without a default means the whole project", async () => {
    model.tables.templates[0].holes = [{ name: "evidence", label: "Evidence" }];
    const made = await instantiateTemplate({ templateId: "templates:1" });
    assert.ok(made.accepted);
    assert.deepEqual(scopeOf(model.tables.documentSnapshots[0]), {
      include: [{ select: "project" }],
      exclude: []
    });
  });

  test("refuses an answer naming a set the project does not hold, and a body naming an undeclared hole", async () => {
    const unknownSet = await instantiateTemplate({
      templateId: "templates:1",
      answers: { evidence: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] } }
    });
    assert.equal(unknownSet.accepted, false);
    assert.match(unknownSet.accepted === false ? unknownSet.detail : "", /resourceSets:9/);

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
          { name: "evidence", label: "Evidence", description: "What happened" },
          { name: "models", label: "Models", default: { include: [{ select: "project" }], exclude: [] } }
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
    model.tables.documents.push(row("documents", "1", { projectId: "p", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "p",
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
      dropped: ["Dropped a prompt's generated output."]
    });
    const held = model.tables.templates[1];
    assert.equal(held.name, "Winter brief shell");
    assert.deepEqual(held.tags, ["Winter"]);
    assert.deepEqual(held.holes, [{ name: "evidence", label: "evidence" }]);
    const kept = (held.body as { rows: { blocks: { marks: { link: unknown }[] }[] }[] }).rows[0]
      .blocks[1].marks[0].link;
    assert.deepEqual(kept, { kind: "url", url: "https://example.com/plan", note: "Scope" });
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  /**
   * Every prompt is a hole, and a scope anybody could have meant is its default.
   *
   * Nothing was declared and nothing was named: the prompt was written, the
   * template was made, and it asks. That is the whole of the link, and it is
   * what makes a template from a document full of prompts worth placing.
   */
  test("turns an authored prompt scope into a hole that keeps it as the default", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "p", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "p",
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
    assert.deepEqual(held.holes, [
      {
        name: "Prompt 1",
        label: "Prompt 1",
        default: { include: [{ select: "project" }], exclude: [] }
      }
    ]);
    assert.deepEqual(scopeOf(held), { include: [{ select: "hole", name: "Prompt 1" }], exclude: [] });
  });

  test("gives a hole no default when the prompt read something particular", async () => {
    model.tables.documents.push(row("documents", "1", { projectId: "p", title: "Winter brief" }));
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "1", {
        projectId: "p",
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
      { name: "evidence", label: "evidence", description: "What happened" }
    ]);
    assert.deepEqual(scopeOf(held), { include: [{ select: "hole", name: "evidence" }], exclude: [] });
  });

  test("makes a deck template from the whole deck or from one of its slides", async () => {
    model.tables.slideDecks.push(row("slideDecks", "1", { projectId: "p", title: "Board" }));
    model.tables.slideDeckSnapshots.push(
      row("slideDeckSnapshots", "1", {
        projectId: "p",
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
      patch: { holes: [{ name: "evidence", label: "Evidence", default: excluding }] }
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
        default: { include: [{ select: "set", setId: bound[0]._id }], exclude: [] }
      }
    ]);
  });

  test("a rule that can be said inline writes nothing, and clears a row it had", async () => {
    await updateTemplate({
      templateId: "templates:1",
      baseRevision: 1,
      patch: { holes: [{ name: "evidence", label: "Evidence", default: excluding }] }
    });
    const result = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        holes: [
          {
            name: "evidence",
            label: "Evidence",
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
      patch: { holes: [{ name: "evidence", label: "Evidence", default: excluding }] }
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
        projectId: "other",
        name: "Elsewhere",
        set: { include: [], exclude: [] },
        createdBy: { kind: "user", userId: "u" },
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
            default: { include: [{ select: "set", setId: "resourceSets:9" }], exclude: [] }
          }
        ]
      }
    });
    assert.equal(result.accepted, false);
    assert.equal(result.accepted === false && result.reason, "unsupported-body");
  });
});
