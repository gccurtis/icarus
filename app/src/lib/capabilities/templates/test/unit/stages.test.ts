import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

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
    createMany: (table: string, fields: readonly unknown[]) =>
      fields.map((entry) => model.store.create(table, entry)),
    removeRows: (table: string, ids: readonly string[]) => {
      const rows = model.tables[table] ?? [];
      if (ids.some((id) => !rows.some((row) => row._id === id))) throw new Error(`no '${table}' row`);
      model.tables[table] = rows.filter((row) => !ids.includes(row._id));
    },
    removeFieldFromRows: (table: string, ids: readonly string[], field: string) => {
      for (const row of model.tables[table] ?? []) if (ids.includes(row._id)) delete row[field];
    },
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
      if (index < 0) throw new Error(`no row ${path}`);
      rows.splice(index, 1);
    },
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

const { openTemplateStage } = await import(
  "$capabilities/templates/api/open-template-stage/open-template-stage"
);
const { commitTemplateStage } = await import(
  "$capabilities/templates/api/commit-template-stage/commit-template-stage"
);
const { discardTemplateStage } = await import(
  "$capabilities/templates/api/discard-template-stage/discard-template-stage"
);
const { enqueueSemanticSync } = await import("$capabilities/semantic-overlay/index");
const { readResourceTemplate } = await import(
  "$capabilities/templates/api/read-resource-template/read-resource-template"
);
const { readTemplateStageIndex } = await import(
  "$capabilities/templates/api/read-template-stage-index/read-template-stage-index"
);
const { readTemplateLibrary } = await import(
  "$capabilities/templates/api/read-template-library/read-template-library"
);
const { readTemplate } = await import("$capabilities/templates/api/read-template/read-template");
const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);
const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);

const text = (id: string, display: string) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-a`, kind: "literal", text: display }],
  display,
  marks: []
});

const documentBody = {
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks: [text("b1", "Incident write-up")] }]
};

const deckBody = {
  resource: "slides",
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  slides: [{ id: "s1", elements: [], notes: [] }],
  sections: []
};

const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
  ...fields,
  _id: `${table}:${id}`,
  _creationTime: 1
});

const template = (id: string, body: unknown = documentBody, extra: Record<string, unknown> = {}): Row =>
  row("templates", id, {
    projectId: "projects:p",
    userId: "users:u",
    name: `Template ${id}`,
    tags: [],
    body,
    holes: [],
    createdBy: { kind: "user", userId: "users:u" },
    revision: 2,
    updatedAt: 20,
    ...extra
  });

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.scope = { projectId: "projects:p", userId: "users:u", username: "Uma" };
  model.tables = {
    users: [{ _id: "users:u", _creationTime: 1, displayName: "Uma" }],
    memberships: [row("memberships", "1", {
      userId: "users:u",
      projectId: "projects:p",
      token: "u",
      role: "owner"
    })],
    templates: [template("1"), template("2", deckBody)],
    templateVersions: [],
    templateStages: [],
    resourceSets: [],
    documents: [],
    documentSnapshots: [],
    documentChangeSets: [],
    slideDecks: [],
    slideDeckSnapshots: [],
    slideDeckChangeSets: [],
    spreadsheets: [],
    commentThreads: [],
    comments: []
  };
});

describe("opening a stage", () => {
  test("makes a scratch document holding the template body and a stage row, once", async () => {
    const opened = await openTemplateStage({ templateId: "templates:1" });
    assert.deepEqual(opened, {
      accepted: true,
      stageId: "templateStages:1",
      templateId: "templates:1",
      templateRevision: 2,
      target: "document",
      resourceId: "documents:1",
      reused: false
    });
    assert.equal(model.tables.documents[0].title, "Template · Template 1");
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.deepEqual(model.tables.documentSnapshots[0].body, { rows: documentBody.rows });
    assert.deepEqual(model.tables.templateStages[0], {
      _id: "templateStages:1",
      _creationTime: 1,
      projectId: "projects:p",
      templateId: "templates:1",
      templateRevision: 2,
      target: "document",
      resourceId: "documents:1",
      createdBy: { kind: "user", userId: "users:u" },
      updatedAt: 500
    });

    const again = await openTemplateStage({ templateId: "templates:1" });
    assert.deepEqual(again, { ...opened, reused: true });
    assert.equal(model.tables.documents.length, 1);

    const library = await readTemplateLibrary();
    assert.deepEqual(library.templates.map((item) => item.id), ["templates:1", "templates:2"]);
    const detail = await readTemplate({ templateId: "templates:1" });
    assert.ok(detail !== null && !("unavailable" in detail));
    assert.equal("stage" in detail, false);
  });

  /**
   * A working copy is a draft of a template, not the project's material.
   *
   * The copy is an ordinary document, so saving it takes the ordinary path and
   * would put unfinished template words in front of every agent that retrieves.
   */
  test("is refused by the overlay, however the question is asked", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documents.push(
      row("documents", "9", { projectId: "projects:p", title: "A real document" })
    );
    model.tables.documentSnapshots.push(
      row("documentSnapshots", "9", {
        projectId: "projects:p",
        resourceId: "documents:9",
        role: "leader",
        revision: 1,
        body: { rows: [] }
      })
    );

    assert.equal(await enqueueSemanticSync({ ref: { kind: "document", id: "documents:1" } }), null);
    assert.deepEqual(model.tables.semanticSyncJobs ?? [], []);

    const real = await enqueueSemanticSync({ ref: { kind: "document", id: "documents:9" } });
    assert.notEqual(real, null);
    assert.deepEqual(
      (model.tables.semanticSyncJobs ?? []).map((job) => job.ref),
      [{ kind: "document", id: "documents:9" }]
    );
  });

  test("is shared by everyone in the project rather than kept per viewer", async () => {
    const opened = await openTemplateStage({ templateId: "templates:1" });
    assert.ok(opened.accepted);
    const read = await readResourceTemplate({ resourceId: "documents:1" });
    assert.equal(read.stage?.stageId, "templateStages:1");
    assert.equal("mine" in (read.stage ?? {}), false);

    model.scope = { projectId: "projects:p", userId: "users:v", username: "Victor" };
    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.equal(saved.accepted, true);
    assert.equal(model.tables.templates[0].revision, 3);
  });

  test("a name or hole edit carries every stage of the template to the new revision", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    const renamed = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: { name: "Renamed" }
    });
    assert.ok(renamed.accepted);
    assert.equal(model.tables.templateStages[0].templateRevision, 3);
    const read = await readResourceTemplate({ resourceId: "documents:1" });
    assert.equal(read.stage?.stagedRevision, 3);
    assert.equal(read.stage?.currentRevision, 3);
  });

  test("stages a deck template as a deck and refuses a spreadsheet", async () => {
    const opened = await openTemplateStage({ templateId: "templates:2" });
    assert.ok(opened.accepted);
    assert.equal(opened.target, "slides");
    assert.equal(model.tables.slideDecks[0].title, "Template · Template 2");
    assert.equal((model.tables.slideDeckSnapshots[0].body as { slides: unknown[] }).slides.length, 1);

    model.tables.templates.push(
      template("3", {
        resource: "spreadsheet",
        cells: {},
        formatRules: [],
        print: { page: { paper: "letter", orientation: "portrait", margins: { top: 1, right: 1, bottom: 1, left: 1 } } },
        styles: { defaultKey: "body", styles: { body: { name: "Body" } } }
      })
    );
    const refused = await openTemplateStage({ templateId: "templates:3" });
    assert.deepEqual(refused, {
      accepted: false,
      templateId: "templates:3",
      reason: "unsupported-body",
      revision: 2,
      detail: "a spreadsheet template opens for editing once the spreadsheet editor lands"
    });
  });
});

describe("reading what a resource is", () => {
  test("names the stage, and nothing for a plain resource", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documents.push(row("documents", "10", { projectId: "projects:p", title: "Plain" }));

    assert.deepEqual(await readResourceTemplate({ resourceId: "documents:1" }), {
      resourceId: "documents:1",
      stage: {
        stageId: "templateStages:1",
        templateId: "templates:1",
        templateName: "Template 1",
        target: "document",
        stagedRevision: 2,
        currentRevision: 2
      }
    });
    assert.deepEqual(await readResourceTemplate({ resourceId: "documents:10" }), {
      resourceId: "documents:10",
      stage: null
    });
  });

  test("indexes only exact live stage identities in the current project", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    await openTemplateStage({ templateId: "templates:2" });

    assert.deepEqual(await readTemplateStageIndex(), {
      stages: [
        {
          stageId: "templateStages:1",
          templateId: "templates:1",
          templateName: "Template 1",
          target: "document",
          resourceId: "documents:1"
        },
        {
          stageId: "templateStages:2",
          templateId: "templates:2",
          templateName: "Template 2",
          target: "slides",
          resourceId: "slideDecks:1"
        }
      ],
      unavailable: []
    });

    model.scope = { projectId: "projects:other", userId: "users:u", username: "Uma" };
    assert.deepEqual(await readTemplateStageIndex(), { stages: [], unavailable: [] });
  });
});

describe("saving a stage", () => {
  test("writes the scratch body into the template as the next revision, made portable", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documentSnapshots[0].body = {
      rows: [
        {
          id: "r1",
          kind: "blocks",
          blocks: [
            {
              ...text("b1", "Edited"),
              marks: [
                { id: "m1", from: { atom: "b1-a", offset: 0 }, to: { atom: "b1-a", offset: 2 }, link: { kind: "resource", ref: { kind: "document", id: "documents:4" } } }
              ]
            },
            {
              id: "p1",
              type: "prompt",
              atoms: [{ id: "p1-a", kind: "literal", text: "Sum up" }],
              display: "Sum up",
              prompt: "Sum up",
              marks: [],
              scope: { include: [{ select: "hole", name: "evidence" }], exclude: [] },
              state: "idle"
            }
          ]
        }
      ]
    };

    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.deepEqual(saved, {
      accepted: true,
      stageId: "templateStages:1",
      templateId: "templates:1",
      revision: 3,
      dropped: ["Dropped a link to something in the project."]
    });
    const held = model.tables.templates[0];
    assert.equal(held.revision, 3);
    assert.deepEqual((held.body as { rows: unknown[] }).rows.length, 1);
    assert.deepEqual(held.holes, [{ name: "evidence", label: "evidence", kind: "scope" }]);
    assert.equal(model.tables.templateVersions.length, 1);
    assert.equal(model.tables.templateStages[0].templateRevision, 3);

    const stale = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.equal(stale.accepted, false);
    assert.equal(stale.accepted === false && stale.reason, "stale");
  });

  test("refuses a staged prompt scope owned by another resource", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documentSnapshots[0].body = {
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
              derivedOutputId: "derivedOutputs:1",
              hole: { name: "evidence" },
              state: "idle"
            }
          ]
        }
      ]
    };
    model.tables.derivedOutputs = [
      row("derivedOutputs", "1", {
        projectId: "projects:p",
        prompt: "What matters?",
        scope: { include: [{ select: "set", setId: "resourceSets:1" }], exclude: [] }
      })
    ];
    model.tables.resourceSets.push(
      row("resourceSets", "1", {
        projectId: "projects:p",
        boundTo: { kind: "resource", resourceId: "documents:9", hole: "evidence" },
        set: {
          include: [{ select: "resources", refs: [{ kind: "document", id: "documents:9" }] }],
          exclude: []
        },
        createdBy: { kind: "user", userId: "users:u" },
        revision: 1,
        updatedAt: 1
      })
    );

    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });

    assert.equal(saved.accepted, false);
    assert.equal(saved.accepted ? "" : saved.reason, "unsupported-body");
    assert.match(saved.accepted ? "" : saved.detail, /private/);
    assert.equal(model.tables.templates[0].revision, 2);
    assert.deepEqual(model.tables.templateVersions, []);
  });

  test("saves a deck stage back however many slides it holds now", async () => {
    await openTemplateStage({ templateId: "templates:2" });
    model.tables.slideDeckSnapshots[0].body = {
      ...deckBody,
      slides: [
        { id: "s1", elements: [], notes: [] },
        { id: "s2", elements: [], notes: [] }
      ]
    };
    delete (model.tables.slideDeckSnapshots[0].body as Record<string, unknown>).resource;

    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.ok(saved.accepted);
    assert.equal((model.tables.templates[1].body as { slides: unknown[] }).slides.length, 2);
  });

  test("refuses to save a stage from another project", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.scope = { projectId: "projects:other", userId: "users:u", username: "Uma" };
    const saved = await commitTemplateStage({ stageId: "templateStages:1", baseRevision: 2 });
    assert.equal(saved.accepted === false && saved.reason, "not-found");
  });
});

describe("discarding a stage", () => {
  test("removes the stage and everything the scratch resource accumulated", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    model.tables.documentChangeSets.push(
      row("documentChangeSets", "1", { projectId: "projects:p", resourceId: "documents:1", revision: 1 })
    );
    model.tables.commentThreads.push(
      row("commentThreads", "1", { projectId: "projects:p", target: { kind: "document", id: "documents:1" } }),
      row("commentThreads", "2", { projectId: "projects:p", target: { kind: "document", id: "documents:7" } })
    );
    model.tables.comments.push(
      row("comments", "1", { projectId: "projects:p", threadId: "commentThreads:1" }),
      row("comments", "2", { projectId: "projects:p", threadId: "commentThreads:2" })
    );

    const discarded = await discardTemplateStage({ stageId: "templateStages:1" });
    assert.deepEqual(discarded, {
      accepted: true,
      stageId: "templateStages:1",
      templateId: "templates:1",
      target: "document",
      resourceId: "documents:1"
    });
    assert.deepEqual(model.tables.templateStages, []);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.documentSnapshots, []);
    assert.deepEqual(model.tables.documentChangeSets, []);
    assert.deepEqual(model.tables.commentThreads.map((thread) => thread._id), ["commentThreads:2"]);
    assert.deepEqual(model.tables.comments.map((comment) => comment._id), ["comments:2"]);
  });

  /**
   * A discarded draft must leave nothing an agent can still find.
   *
   * Ingestion refuses a stage, so in the ordinary case there is nothing here to
   * take back. These rows are what an earlier save, or a forced backfill, could
   * have left behind — and another resource's rows have to survive it.
   */
  test("takes back everything the overlay learned about the scratch resource", async () => {
    await openTemplateStage({ templateId: "templates:1" });
    const mine = { kind: "document", id: "documents:1" };
    const other = { kind: "document", id: "documents:9" };
    model.tables.semanticSyncJobs = [
      row("semanticSyncJobs", "1", { projectId: "projects:p", ref: mine, state: "queued" }),
      row("semanticSyncJobs", "2", { projectId: "projects:p", ref: other, state: "queued" })
    ];
    model.tables.semanticMaterialJobs = [
      row("semanticMaterialJobs", "1", { projectId: "projects:p", ref: mine, state: "queued" })
    ];
    model.tables.semanticSources = [
      row("semanticSources", "1", { projectId: "projects:p", ref: mine, revision: 1 }),
      row("semanticSources", "2", { projectId: "projects:p", ref: other, revision: 1 })
    ];
    model.tables.semanticMaterials = [
      row("semanticMaterials", "1", { projectId: "projects:p", source: { kind: "resourceContent", ref: mine } })
    ];
    model.tables.semanticMaterialPlacements = [
      row("semanticMaterialPlacements", "1", { projectId: "projects:p", ref: mine })
    ];
    model.tables.semanticMaterialHistory = [
      row("semanticMaterialHistory", "1", { projectId: "projects:p", material: { source: { ref: mine } } })
    ];
    model.tables.semanticObjects = [
      row("semanticObjects", "1", { projectId: "projects:p", lane: "text", semanticSourceId: "semanticSources:1" }),
      row("semanticObjects", "2", { projectId: "projects:p", lane: "material", semanticMaterialId: "semanticMaterials:1" }),
      row("semanticObjects", "3", { projectId: "projects:p", lane: "text", semanticSourceId: "semanticSources:2" })
    ];

    await discardTemplateStage({ stageId: "templateStages:1" });

    assert.deepEqual(model.tables.semanticSyncJobs.map((job) => job._id), ["semanticSyncJobs:2"]);
    assert.deepEqual(model.tables.semanticMaterialJobs, []);
    assert.deepEqual(model.tables.semanticSources.map((source) => source._id), ["semanticSources:2"]);
    assert.deepEqual(model.tables.semanticMaterials, []);
    assert.deepEqual(model.tables.semanticMaterialPlacements, []);
    assert.deepEqual(model.tables.semanticMaterialHistory, []);
    assert.deepEqual(model.tables.semanticObjects.map((held) => held._id), ["semanticObjects:3"]);
  });

  test("goes with the template when the template is deleted, and is out of reach from another project", async () => {
    await openTemplateStage({ templateId: "templates:1" });

    model.scope = { projectId: "projects:other", userId: "users:u", username: "Uma" };
    const elsewhere = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
    assert.equal(elsewhere.accepted === false && elsewhere.reason, "not-found");

    model.scope = { projectId: "projects:p", userId: "users:u", username: "Uma" };
    const here = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });
    assert.equal(here.accepted, true);
    assert.deepEqual(model.tables.templateStages, []);
    assert.deepEqual(model.tables.documents, []);
    assert.deepEqual(model.tables.templates.map((held) => held._id), ["templates:2"]);
  });
});
