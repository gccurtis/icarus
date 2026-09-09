import assert from "node:assert/strict";
import { beforeEach, describe, test, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const model = vi.hoisted(() => ({
  calls: [] as string[],
  scope: { projectId: "p", userId: "u", username: "Uma" },
  tables: {} as Record<string, Row[]>,
  store: {
    create: (table: string, fields: unknown) => {
      model.calls.push(`create ${table}`);
      const rows = (model.tables[table] ??= []);
      const highest = rows.reduce((seen, row) => {
        const parsed = Number(row._id.slice(table.length + 1));
        return Number.isFinite(parsed) ? Math.max(seen, parsed) : seen;
      }, 0);
      const id = `${table}:${highest + 1}`;
      rows.push({ ...(fields as Record<string, unknown>), _id: id, _creationTime: Date.now() });
      return id;
    },
    createMany: (table: string, fields: readonly unknown[]) => {
      model.calls.push(`createMany ${table}`);
      const rows = (model.tables[table] ??= []);
      const highest = rows.reduce((seen, row) => {
        const parsed = Number(row._id.slice(table.length + 1));
        return Number.isFinite(parsed) ? Math.max(seen, parsed) : seen;
      }, 0);
      return fields.map((entry, index) => {
        const id = `${table}:${highest + index + 1}`;
        rows.push({
          ...(entry as Record<string, unknown>),
          _id: id,
          _creationTime: Date.now()
        });
        return id;
      });
    },
    removeRows: (table: string, ids: readonly string[]) => {
      model.calls.push(`removeRows ${table}`);
      const rows = model.tables[table] ?? [];
      if (ids.some((id) => !rows.some((row) => row._id === id))) {
        throw new Error(`no '${table}' row`);
      }
      const wanted = new Set(ids);
      model.tables[table] = rows.filter((row) => !wanted.has(row._id));
    },
    removeFieldFromRows: (table: string, ids: readonly string[], field: string) => {
      model.calls.push(`removeFieldFromRows ${table}`);
      const rows = model.tables[table] ?? [];
      if (ids.some((id) => !rows.some((row) => row._id === id))) {
        throw new Error(`no '${table}' row`);
      }
      const wanted = new Set(ids);
      for (const row of rows) {
        if (wanted.has(row._id)) delete row[field];
      }
    },
    read: (path: string) => {
      model.calls.push(`read ${path}`);
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
      const [table, id, ...fields] = path.split(".");
      const rows = model.tables[table] ?? [];
      const index = rows.findIndex((row) => row._id === id);
      if (index < 0) throw new Error(`no row ${path}`);
      if (fields.length === 0) rows.splice(index, 1);
      else delete rows[index][fields[0]];
    },
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T => {
      model.calls.push("transaction");
      return work(model.store as unknown as StoreUnitOfWork);
    }
  }
}));

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => {
    model.calls.push("scope");
    return Promise.resolve(model.scope);
  }
}));

const { createTemplate } = await import(
  "$capabilities/templates/api/create-template/create-template"
);
const { duplicateTemplate } = await import(
  "$capabilities/templates/api/duplicate-template/duplicate-template"
);
const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);
const { readTemplate } = await import(
  "$capabilities/templates/api/read-template/read-template"
);
const { readTemplateLibrary } = await import(
  "$capabilities/templates/api/read-template-library/read-template-library"
);
const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);
const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);
const { bodyOf, variablesOf } = await import(
  "$capabilities/templates/api/shared/validation"
);

const documentBody = { resource: "document", rows: [] } as const;
const slidesBody = {
  resource: "slides",
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  slides: [],
  sections: []
} as const;
const spreadsheetBody = {
  resource: "spreadsheet",
  cells: {
    B2: { value: { kind: "number", value: 42 }, merge: "C2" },
    A1: { expression: "=B2*2" }
  },
  columnWidths: { B: 140 },
  rowHeights: { "2": 30 },
  formatRules: [{ from: "A1", to: "B2", style: "money" }],
  frozenRows: 1,
  print: {
    page: {
      paper: "letter",
      orientation: "landscape",
      margins: { top: 1, right: 1, bottom: 1, left: 1 }
    },
    area: { from: "A1", to: "C8" },
    repeatRows: "1:2",
    repeatColumns: "A:B"
  },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } }
} as const;

const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
  ...fields,
  _id: table === "users" ? id : `${table}:${id}`,
  _creationTime: typeof fields._creationTime === "number" ? fields._creationTime : 1
});

const template = (
  id: string,
  owner: string,
  body: unknown = documentBody,
  extra: Record<string, unknown> = {}
): Row =>
  row("templates", id, {
    userId: owner,
    name: `Template ${id}`,
    tags: ["Useful"],
    body,
    variables: [],
    createdBy: { kind: "user", userId: owner },
    revision: 2,
    updatedAt: 20,
    ...extra
  });

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.calls.length = 0;
  model.scope = { projectId: "p", userId: "u", username: "Uma" };
  model.tables = {
    users: [
      row("users", "u", { displayName: "Uma", authSubject: "u", settings: "{}", updatedAt: 1 }),
      row("users", "v", { displayName: "Victor", authSubject: "v", settings: "{}", updatedAt: 1 }),
      row("users", "x", { displayName: "Xavier", authSubject: "x", settings: "{}", updatedAt: 1 })
    ],
    memberships: [
      row("memberships", "1", { userId: "u", projectId: "p", token: "u", role: "owner" }),
      row("memberships", "2", { userId: "v", projectId: "p", token: "v", role: "editor" }),
      row("memberships", "3", { userId: "x", projectId: "other", token: "x", role: "owner" })
    ],
    templates: [],
    templateVersions: [],
    documents: [],
    documentSnapshots: [],
    slideDecks: [],
    slideDeckSnapshots: [],
    spreadsheets: [],
    spreadsheetSnapshots: [],
    sheetCells: [],
    connectors: [],
    agentTasks: []
  };
});

describe("the project library", () => {
  test("treats a malformed table root as unavailable storage rather than throwing", async () => {
    model.tables.templates = {} as Row[];

    const answer = await readTemplateLibrary();

    assert.deepEqual(answer.templates, []);
    assert.deepEqual(answer.unavailable, []);
  });

  test("does not forward an unbounded referenced actor label", async () => {
    model.tables.templates.push(template("1", "u"));
    model.tables.users[0].displayName = "x".repeat(161);

    const answer = await readTemplateLibrary();

    assert.equal(answer.templates[0].createdByName, "Someone");
  });

  test("quarantines duplicate ids across owners and tolerates malformed resource rows", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, {
        createdBy: { kind: "user", userId: "x" }
      }),
      template("1", "v", slidesBody)
    );
    model.tables.documents.push(null as unknown as Row);

    const library = await readTemplateLibrary();
    const detail = await readTemplate({ templateId: "templates:1" });

    assert.deepEqual(library.templates, []);
    assert.equal(library.unavailable.length, 1);
    assert.match(library.unavailable[0].detail, /more than one stored row/);
    assert.ok(detail !== null && "unavailable" in detail);
    assert.equal("createdBy" in library.unavailable[0], false);
  });

  test("resolves creator labels only through actors authorized in this project", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, {
        createdBy: { kind: "user", userId: "x" }
      })
    );

    const answer = await readTemplateLibrary();

    assert.equal(answer.templates[0].createdByName, "Someone");
    assert.equal("createdBy" in answer.templates[0], false);
    assert.equal("ownerId" in answer.templates[0], false);
    assert.equal("viewerId" in answer, false);
    assert.equal("projectId" in answer, false);
  });

  test("projects only owner-visible templates with project-local recency", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, { name: "Mine", updatedAt: 30 }),
      template("2", "v", slidesBody, { name: "Shared", updatedAt: 40 }),
      template("3", "x", documentBody, { name: "Hidden", updatedAt: 50 })
    );
    model.tables.documents.push(
      row("documents", "1", {
        projectId: "p",
        templateId: "templates:1",
        updatedAt: 800,
        _creationTime: 80
      }),
      row("documents", "2", {
        projectId: "other",
        templateId: "templates:1",
        updatedAt: 999,
        _creationTime: 999
      })
    );
    model.tables.slideDecks.push(
      row("slideDecks", "1", {
        projectId: "p",
        templateId: "templates:2",
        updatedAt: 900,
        _creationTime: 90
      })
    );

    const answer = await readTemplateLibrary();

    assert.equal(model.calls[0], "scope");
    assert.deepEqual(answer.templates.map((item) => item.id), ["templates:1"]);
    assert.deepEqual(
      answer.templates.map((item) => [item.availability, item.createdByName, item.lastUsedAt]),
      [["personal", "Uma", 80]]
    );
    assert.equal(answer.templates[0].canEdit, true);
    assert.equal(answer.templates[0].canDelete, true);
    assert.deepEqual(answer.unavailable, []);
  });

  test("reads an owned full body and does not disclose another user's template", async () => {
    model.tables.templates.push(template("1", "u", slidesBody), template("2", "v"));

    const answer = await readTemplate({ templateId: "templates:1" });
    assert.ok(answer !== null && !("unavailable" in answer));
    assert.equal(answer.body.resource, "slides");
    assert.equal(await readTemplate({ templateId: "templates:2" }), null);
  });

  test("quarantines an invalid owned row without hiding healthy templates", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, { name: "Healthy" }),
      template("2", "u", { resource: "document", blocks: [] }, { name: "Legacy" })
    );

    const library = await readTemplateLibrary();
    const selected = await readTemplate({ templateId: "templates:2" });

    assert.deepEqual(library.templates.map((item) => item.name), ["Healthy"]);
    assert.equal(library.unavailable.length, 1);
    assert.equal(library.unavailable[0].templateId, "templates:2");
    assert.match(library.unavailable[0].detail, /not a valid document template body/);
    assert.ok(selected !== null && "unavailable" in selected);
    assert.equal(selected.templateId, "templates:2");
  });

  test("quarantines a path-like row id and rejects it at every input door", async () => {
    const legitimate = template("1", "u", documentBody, { description: "Keep me" });
    const disguised = {
      ...template("evil", "u", documentBody),
      _id: "templates:1.description"
    };
    model.tables.templates.push(legitimate, disguised);

    const library = await readTemplateLibrary();

    assert.deepEqual(library.templates.map((item) => item.id), ["templates:1"]);
    assert.equal(library.unavailable[0].templateId, "templates:1.description");
    await assert.rejects(
      () =>
        updateTemplate({
          templateId: "templates:1.description",
          baseRevision: 2,
          patch: { name: "Hijacked" }
        }),
      /one canonical templates row id/
    );
    assert.equal(model.tables.templates[0].description, "Keep me");
    assert.equal(model.calls.some((call) => call.startsWith("update ")), false);
  });
});

describe("template mutations", () => {
  test("creates every target from a server-owned valid empty body and records revision one", async () => {
    for (const target of ["document", "slides", "spreadsheet"] as const) {
      const answer = await createTemplate({ target, name: `New ${target}`, tags: [" New ", "new"] });
      assert.equal(answer.accepted, true);
      const created = model.tables.templates.find((candidate) => candidate._id === answer.templateId);
      assert.equal((created?.body as { resource: string }).resource, target);
      assert.deepEqual(created?.tags, ["New"]);
    }
    assert.equal(model.tables.templateVersions.length, 3);
    assert.deepEqual(model.tables.templateVersions.map((version) => version.revision), [1, 1, 1]);
  });

  test("updates only an owner's current revision and snapshots the accepted result", async () => {
    model.tables.templates.push(template("1", "u"), template("2", "v"));

    assert.deepEqual(
      await updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: { name: "Stale" } }),
      {
        accepted: false,
        templateId: "templates:1",
        reason: "stale",
        revision: 2,
        detail: "authored against revision 1, the template is at 2"
      }
    );
    assert.equal(
      (
        await updateTemplate({
          templateId: "templates:2",
          baseRevision: 2,
          patch: { name: "No" }
        })
      ).accepted,
      false
    );
    const accepted = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: { name: "Renamed", description: "  Clearer  ", tags: ["One", "one", "Two"] }
    });
    assert.deepEqual(accepted, { accepted: true, templateId: "templates:1", revision: 3 });
    assert.deepEqual(model.tables.templates[0].tags, ["One", "Two"]);
    assert.equal(model.tables.templates[0].description, "Clearer");
    assert.equal(model.tables.templateVersions[0].revision, 3);
  });

  test("updates variable prose without exposing its stable key or default to editing", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, {
        variables: [
          {
            name: "evidence",
            label: "Evidence",
            description: "Old help",
            default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
          }
        ]
      })
    );

    const answer = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: {
        variableDescription: { name: "evidence", description: "  Choose the evidence set.  " }
      }
    });

    assert.deepEqual(answer, { accepted: true, templateId: "templates:1", revision: 3 });
    assert.deepEqual(model.tables.templates[0].variables, [
      {
        name: "evidence",
        label: "Evidence",
        description: "Choose the evidence set.",
        default: { include: [{ select: "kinds", kinds: ["finding"] }], exclude: [] }
      }
    ]);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  test("duplicates a visible template into a new viewer-owned template", async () => {
    model.tables.templates.push(template("1", "u", slidesBody, { description: "Source" }));

    const answer = await duplicateTemplate({ templateId: "templates:1", name: "My copy" });

    assert.equal(answer.accepted, true);
    const copy = model.tables.templates.find((candidate) => candidate._id === "templates:2");
    assert.equal(copy?.userId, "u");
    assert.equal(copy?.name, "My copy");
    assert.deepEqual(copy?.createdBy, { kind: "user", userId: "u" });
    assert.notEqual(copy?.body, model.tables.templates[0].body);
    assert.notEqual(copy?.variables, model.tables.templates[0].variables);
    assert.equal(model.tables.templateVersions.length, 1);
  });

  test("refuses to version, duplicate, or remove a malformed stored template", async () => {
    model.tables.templates.push(
      template("1", "u", { resource: "document", blocks: [] }, { name: "Legacy" })
    );

    const updated = await updateTemplate({
      templateId: "templates:1",
      baseRevision: 2,
      patch: { name: "Still legacy" }
    });
    const duplicated = await duplicateTemplate({ templateId: "templates:1" });
    const removed = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });

    assert.equal(updated.accepted, false);
    assert.equal(updated.accepted ? "" : updated.reason, "unsupported-body");
    assert.equal(duplicated.accepted, false);
    assert.equal(duplicated.accepted ? "" : duplicated.reason, "unsupported-body");
    assert.equal(removed.accepted, false);
    assert.equal(removed.accepted ? "" : removed.reason, "unsupported-body");
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.templateVersions.length, 0);
  });

  test("refuses to advance an exhausted safe revision counter", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, { revision: Number.MAX_SAFE_INTEGER })
    );

    const answer = await updateTemplate({
      templateId: "templates:1",
      baseRevision: Number.MAX_SAFE_INTEGER,
      patch: { name: "Overflow" }
    });

    assert.deepEqual(answer, {
      accepted: false,
      templateId: "templates:1",
      reason: "unsupported-body",
      revision: Number.MAX_SAFE_INTEGER,
      detail: "the template revision counter is exhausted"
    });
    assert.equal(model.tables.templates[0].name, "Template 1");
    assert.equal(model.tables.templateVersions.length, 0);
  });

  test("keeps a generated copy name inside the represented name boundary", async () => {
    model.tables.templates.push(template("1", "u", slidesBody, { name: "x".repeat(160) }));

    const answer = await duplicateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, true);
    const copy = model.tables.templates.find((candidate) => candidate._id === "templates:2");
    assert.equal(typeof copy?.name === "string" && copy.name.length, 160);
    assert.equal(typeof copy?.name === "string" && copy.name.endsWith(" copy"), true);
  });

  test("refuses cross-project dangling provenance, then deletes after clearing local provenance", async () => {
    model.tables.templates.push(template("1", "u"));
    model.tables.templateVersions.push(
      row("templateVersions", "1", { templateId: "templates:1", revision: 1 }),
      row("templateVersions", "2", { templateId: "templates:1", revision: 2 })
    );
    model.tables.documents.push(
      row("documents", "1", { projectId: "p", templateId: "templates:1", updatedAt: 1 }),
      row("documents", "2", { projectId: "other", templateId: "templates:1", updatedAt: 1 })
    );

    assert.deepEqual(await removeTemplate({ templateId: "templates:1", baseRevision: 2 }), {
      accepted: false,
      templateId: "templates:1",
      reason: "in-use-elsewhere",
      revision: 2,
      detail: "this template is referenced outside the current project and cannot be deleted here"
    });
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.templateVersions.length, 2);

    delete model.tables.documents[1].templateId;
    assert.deepEqual(await removeTemplate({ templateId: "templates:1", baseRevision: 2 }), {
      accepted: true,
      templateId: "templates:1",
      revision: 2
    });
    assert.equal(model.tables.templates.length, 0);
    assert.equal(model.tables.templateVersions.length, 0);
    assert.equal("templateId" in model.tables.documents[0], false);
    assert.equal("templateId" in model.tables.documents[1], false);
  });

  test("preflights corrupt version ids before detaching local provenance", async () => {
    model.tables.templates.push(template("1", "u"));
    model.tables.documents.push(
      row("documents", "1", { projectId: "p", templateId: "templates:1", updatedAt: 1 })
    );
    model.tables.templateVersions.push({
      _id: "templateVersions:bad.path",
      _creationTime: 1,
      templateId: "templates:1",
      revision: 2
    });

    const answer = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.documents[0].templateId, "templates:1");
    assert.equal(model.tables.templateVersions.length, 1);
    assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
  });

  test("refuses ambiguous ancillary ids before a batch can touch another claimant", async () => {
    model.tables.templates.push(template("1", "u"));
    model.tables.documents.push(
      row("documents", "1", { projectId: "p", templateId: "templates:1", updatedAt: 1 }),
      row("documents", "1", { projectId: "other", templateId: "templates:other", updatedAt: 1 })
    );
    model.tables.templateVersions.push(
      row("templateVersions", "1", { templateId: "templates:1", revision: 2 })
    );

    const answer = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /provenance id is ambiguous/);
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.documents[0].templateId, "templates:1");
    assert.equal(model.tables.documents[1].templateId, "templates:other");
    assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
  });

  test("refuses an ambiguous version id before deleting another template's history", async () => {
    model.tables.templates.push(template("1", "u"));
    model.tables.templateVersions.push(
      row("templateVersions", "1", { templateId: "templates:1", revision: 2 }),
      row("templateVersions", "1", { templateId: "templates:other", revision: 1 })
    );

    const answer = await removeTemplate({ templateId: "templates:1", baseRevision: 2 });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /version id is ambiguous/);
    assert.equal(model.tables.templates.length, 1);
    assert.equal(model.tables.templateVersions.length, 2);
    assert.equal(model.calls.some((call) => call.startsWith("remove")), false);
  });

  test("refuses malformed input before touching the store", async () => {
    await assert.rejects(
      () => updateTemplate({ templateId: "templates:1", baseRevision: 1, patch: {} }),
      /patch changes at least one field/
    );
    await assert.rejects(
      () =>
        updateTemplate({
          templateId: "templates:1",
          baseRevision: 1,
          patch: { body: slidesBody }
        }),
      /unknown field body/
    );
    assert.deepEqual(model.calls, ["scope", "scope"]);
  });
});

describe("instantiation", () => {
  test("refuses corrupt stored metadata before creating any resource", async () => {
    model.tables.templates.push(
      template("1", "u", documentBody, { name: 42 }),
      template("2", "u", documentBody, { revision: 0 })
    );

    const badName = await instantiateTemplate({ templateId: "templates:1" });
    const badRevision = await instantiateTemplate({ templateId: "templates:2" });

    assert.equal(badName.accepted, false);
    assert.equal(badName.accepted ? "" : badName.reason, "unsupported-body");
    assert.equal(badRevision.accepted, false);
    assert.equal(badRevision.accepted ? "" : badRevision.reason, "unsupported-body");
    assert.equal(badRevision.accepted ? -1 : badRevision.revision, null);
    assert.equal(model.tables.documents.length, 0);
    assert.equal(model.tables.documentSnapshots.length, 0);
  });

  test("creates ordinary document and slide-deck rows with leader snapshots and provenance", async () => {
    model.tables.templates.push(template("1", "u"), template("2", "u", slidesBody));

    const document = await instantiateTemplate({ templateId: "templates:1", name: "Brief" });
    const slides = await instantiateTemplate({ templateId: "templates:2" });

    assert.equal(document.accepted && document.target, "document");
    assert.equal(slides.accepted && slides.target, "slides");
    assert.equal(model.tables.documents[0].templateId, "templates:1");
    assert.equal(model.tables.documentSnapshots[0].role, "leader");
    assert.equal(model.tables.slideDecks[0].templateId, "templates:2");
    assert.equal(model.tables.slideDeckSnapshots[0].revision, 0);
    const readyDeck = model.tables.slideDeckSnapshots[0].body as { slides: { id: string }[] };
    assert.equal(readyDeck.slides.length, 1);
    assert.match(readyDeck.slides[0].id, /^slide-/);
    assert.notEqual(model.tables.documents[0].createdBy, model.tables.documents[0].updatedBy);
    assert.notEqual(model.tables.slideDecks[0].createdBy, model.tables.slideDecks[0].updatedBy);
  });

  test("preserves current document pixel leading without schema inference", async () => {
    model.tables.templates.push(template("1", "u", {
      resource: "document",
      styles: {
        defaultKey: "body",
        styles: { body: { name: "Body", fontSize: 11, lineHeight: 16.5 } }
      },
      rows: []
    }));

    const answer = await instantiateTemplate({ templateId: "templates:1" });
    const snapshot = model.tables.documentSnapshots[0].body as {
      styles: { styles: { body: { lineHeight: number } } };
    };

    assert.equal(answer.accepted, true);
    assert.equal(snapshot.styles.styles.body.lineHeight, 16.5);
  });

  test("refuses a spreadsheet template rather than writing a sheet it cannot describe", async () => {
    model.tables.templates.push(template("1", "u", spreadsheetBody));

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(!answer.accepted && answer.reason, "unsupported-body");
    assert.equal(model.tables.spreadsheets.length, 0);
    assert.equal(model.tables.spreadsheetSnapshots.length, 0);
    assert.equal(model.tables.sheetCells.length, 0);
    assert.equal(model.calls.some((call) => call.startsWith("create")), false);
  });

  test("does not invent a variable-answer contract", async () => {
    model.tables.templates.push(
      template(
        "1",
        "u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  marks: [],
                  scope: {
                    include: [{ select: "variable", name: "region" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        { variables: [{ name: "region", label: "Region" }] }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.deepEqual(answer, {
      accepted: false,
      templateId: "templates:1",
      reason: "variables-required",
      revision: 2,
      detail: "one or more template variables need answers and have no usable default",
      variables: ["region"]
    });
    assert.equal(model.tables.documents.length, 0);
  });

  test("uses represented defaults without asking for an invented value shape", async () => {
    model.tables.templates.push(
      template(
        "1",
        "u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  marks: [],
                  scope: {
                    include: [{ select: "variable", name: "evidence" }],
                    exclude: []
                  },
                  state: "idle"
                },
                {
                  id: "prompt-again",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  marks: [],
                  scope: {
                    include: [{ select: "variable", name: "evidence" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        {
          variables: [
            {
              name: "evidence",
              label: "Evidence",
              default: {
                include: [{ select: "kinds", kinds: ["finding", "document"] }],
                exclude: []
              }
            }
          ]
        }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, true);
    const body = model.tables.documentSnapshots[0].body as {
      rows: { blocks: { scope: unknown }[] }[];
    };
    assert.deepEqual(body.rows[0].blocks[0].scope, {
      include: [{ select: "kinds", kinds: ["finding", "document"] }],
      exclude: []
    });
    assert.deepEqual(body.rows[0].blocks[1].scope, body.rows[0].blocks[0].scope);
    assert.notEqual(body.rows[0].blocks[1].scope, body.rows[0].blocks[0].scope);
    const first = body.rows[0].blocks[0].scope as { include: { kinds: string[] }[] };
    const second = body.rows[0].blocks[1].scope as { include: { kinds: string[] }[] };
    assert.notEqual(first.include[0], second.include[0]);
    assert.notEqual(first.include[0].kinds, second.include[0].kinds);
  });

  test("bounds recursively expanding represented defaults before writing", async () => {
    const variables = Array.from({ length: 16 }, (_, index) => ({
      name: `branch-${index}`,
      label: `Branch ${index}`,
      default:
        index === 15
          ? { include: [{ select: "project" as const }], exclude: [] }
          : {
              include: [
                { select: "variable" as const, name: `branch-${index + 1}` },
                { select: "variable" as const, name: `branch-${index + 1}` }
              ],
              exclude: []
            }
    }));
    model.tables.templates.push(
      template(
        "1",
        "u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  marks: [],
                  scope: {
                    include: [{ select: "variable", name: "branch-0" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        { variables }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /expand beyond 10000 terms/);
    assert.equal(model.tables.documents.length, 0);
  });

  test("refuses a variable-set difference rather than broadening its scope", async () => {
    model.tables.templates.push(
      template(
        "1",
        "u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  marks: [],
                  scope: {
                    include: [{ select: "kinds", kinds: ["document"] }],
                    exclude: [{ select: "variable", name: "other-material" }]
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        {
          variables: [
            {
              name: "other-material",
              label: "Other material",
              default: {
                include: [{ select: "kinds", kinds: ["spreadsheet"] }],
                exclude: [{ select: "project" }]
              }
            }
          ]
        }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.match(answer.accepted ? "" : answer.detail, /cannot be flattened/);
    assert.equal(model.tables.documents.length, 0);
  });

  test("refuses project-bound body ids and unbounded spreadsheet ranges before writing", async () => {
    model.tables.templates.push(
      template("1", "u", {
        resource: "document",
        rows: [
          {
            id: "row",
            kind: "blocks",
            blocks: [
              {
                id: "prompt",
                type: "prompt",
                derivedOutputId: "derivedOutputs:1",
                atoms: [],
                display: "",
                marks: [],
                state: "idle"
              }
            ]
          }
        ]
      }),
      template("2", "u", {
        ...spreadsheetBody,
        print: { ...spreadsheetBody.print, repeatRows: "1:999999999" }
      })
    );

    const projectBound = await instantiateTemplate({ templateId: "templates:1" });
    const unbounded = await instantiateTemplate({ templateId: "templates:2" });

    assert.equal(projectBound.accepted, false);
    assert.equal(projectBound.accepted ? "" : projectBound.reason, "unsupported-body");
    assert.equal(unbounded.accepted, false);
    assert.equal(unbounded.accepted ? "" : unbounded.reason, "unsupported-body");
    assert.equal(model.tables.documents.length, 0);
    assert.equal(model.tables.spreadsheets.length, 0);
  });

  test("returns an explicit refusal for a legacy body an editor cannot open", async () => {
    model.tables.templates.push(template("1", "u", { resource: "document", blocks: [] }));

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "unsupported-body");
    assert.equal(model.tables.documents.length, 0);
  });
});

const changed = (
  source: unknown,
  change: (draft: Record<string, unknown>) => void
): unknown => {
  const draft = structuredClone(source) as Record<string, unknown>;
  change(draft);
  return draft;
};

const fields = (value: unknown): Record<string, unknown> => value as Record<string, unknown>;
const entries = (value: unknown): unknown[] => value as unknown[];

describe("stored template validation", () => {
  test("allows ordinary record-value keys that merely resemble representation ids", () => {
    const body = {
      ...spreadsheetBody,
      cells: {
        A1: {
          value: {
            kind: "record",
            fields: {
              resourceId: { kind: "text", value: "customer-123" },
              userId: { kind: "text", value: "account-owner" }
            }
          }
        }
      }
    };

    assert.doesNotThrow(() => bodyOf(body, "record-keys"));
  });

  test("accepts only canonical represented variables and bounded templated defaults", () => {
    const valid = [
      {
        name: "region",
        label: "Region",
        description: "The operating region.",
        default: {
          include: [{ select: "kinds", kinds: ["finding", "document"] }],
          exclude: [{ select: "project" }]
        }
      }
    ];
    assert.equal(variablesOf(valid, "test").length, 1);

    const invalid = [
      [{ ...valid[0], invented: true }],
      [{ ...valid[0], name: " region" }],
      [{ ...valid[0], label: "x".repeat(501) }],
      [{ ...valid[0], description: "x".repeat(4_001) }],
      [
        {
          ...valid[0],
          default: {
            include: Array.from({ length: 101 }, () => ({ select: "project" })),
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "kinds", kinds: ["finding", "Finding"] }],
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "project", invented: true }],
            exclude: []
          }
        }
      ],
      [
        {
          ...valid[0],
          default: {
            include: [{ select: "variable", name: "Region" }],
            exclude: []
          }
        }
      ],
      [
        { name: "region", label: "Region" },
        { name: "Region", label: "Duplicate by case" }
      ]
    ];
    for (const variables of invalid) {
      assert.throws(() => variablesOf(variables, "test"), /templates\/test:/);
    }
  });

  test("requires exact case for one variable default referencing another", () => {
    assert.throws(
      () =>
        variablesOf(
          [
            { name: "region", label: "Region" },
            {
              name: "evidence",
              label: "Evidence",
              default: {
                include: [{ select: "variable", name: "Region" }],
                exclude: []
              }
            }
          ],
          "test"
        ),
      /default names a declared variable/
    );
  });

  test("validates document furniture, page metrics, proportions, displays, and global ids", () => {
    const body = {
      resource: "document",
      pageSetup: {
        paper: "letter",
        orientation: "portrait",
        margins: { top: 0.75, right: 0.75, bottom: 0.75, left: 0.75 }
      },
      styles: {
        defaultKey: "body",
        styles: { body: { name: "Body", fontSize: 11 } }
      },
      rows: [
        {
          id: "body-row",
          kind: "blocks",
          blocks: [
            {
              id: "body-block",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "body-atom", kind: "literal", text: "Body" }],
              display: "Body",
              marks: [
                {
                  id: "body-mark",
                  from: { atom: "body-atom", offset: 0 },
                  to: { atom: "body-atom", offset: 4 },
                  style: ["bold"]
                }
              ]
            }
          ],
          proportions: [1]
        }
      ],
      header: {
        rows: [
          {
            id: "header-row",
            kind: "blocks",
            blocks: [
              {
                id: "header-block",
                type: "text",
                variant: "paragraph",
                atoms: [{ id: "header-atom", kind: "literal", text: "Header" }],
                display: "Header",
                marks: []
              }
            ]
          }
        ],
        firstPageRows: [{ id: "first-page-divider", kind: "divider", width: 1 }],
        distanceFromEdge: 0.25,
        pageNumber: { position: "end", format: "Page {page}", startAt: 1 }
      },
      footer: {
        rows: [{ id: "footer-divider", kind: "divider", style: "solid" }],
        distanceFromEdge: 0.25
      }
    };
    assert.equal(bodyOf(body, "test").resource, "document");

    const malformed = [
      { ...body, invented: true },
      changed(body, (draft) => {
        const page = fields(draft.pageSetup);
        page.invented = true;
      }),
      changed(body, (draft) => {
        const margins = fields(fields(draft.pageSetup).margins);
        margins.left = 4.5;
        margins.right = 4.5;
      }),
      changed(body, (draft) => {
        const styles = fields(fields(draft.styles).styles);
        fields(styles.body).fontSize = Number.NaN;
      }),
      changed(body, (draft) => {
        fields(draft.header).invented = true;
      }),
      changed(body, (draft) => {
        fields(entries(draft.rows)[0]).proportions = [];
      }),
      changed(body, (draft) => {
        fields(entries(fields(entries(draft.rows)[0]).blocks)[0]).display = "Not body";
      }),
      changed(body, (draft) => {
        const block = fields(entries(fields(entries(draft.rows)[0]).blocks)[0]);
        fields(fields(entries(block.marks)[0]).to).atom = "missing-atom";
      }),
      changed(body, (draft) => {
        const header = fields(draft.header);
        const headerRow = fields(entries(header.rows)[0]);
        const headerBlock = fields(entries(headerRow.blocks)[0]);
        headerBlock.id = "body-block";
      }),
      changed(body, (draft) => {
        const header = fields(draft.header);
        const headerRow = fields(entries(header.rows)[0]);
        const headerBlock = fields(entries(headerRow.blocks)[0]);
        fields(entries(headerBlock.atoms)[0]).id = "body-atom";
      })
    ];
    for (const candidate of malformed) {
      assert.throws(() => bodyOf(candidate, "test"), /body is not a valid document/);
    }
  });

  test("validates current slide layouts, content, references, frames, and deck ids", () => {
    const body = {
      resource: "slides",
      aspectRatio: "16:9",
      theme: { colors: { text: "ink", accent: "blue", muted: "muted" } },
      styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
      layouts: [
        {
          id: "layout-title",
          key: "title",
          name: "Title",
          locked: [],
          placeholders: [
            {
              role: "title",
              frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
              styleKey: "body"
            }
          ]
        }
      ],
      slides: [
        {
          id: "slide-1",
          layoutKey: "title",
          elements: [
            {
              id: "element-1",
              frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 },
              overflow: "shrink",
              fromPlaceholder: "title",
              content: {
                type: "text",
                block: {
                  id: "slide-block",
                  type: "text",
                  variant: "heading",
                  atoms: [{ id: "slide-atom", kind: "literal", text: "Title" }],
                  display: "Title",
                  marks: []
                }
              }
            }
          ],
          notes: [
            {
              id: "notes-block",
              type: "text",
              variant: "paragraph",
              atoms: [{ id: "notes-atom", kind: "literal", text: "Notes" }],
              display: "Notes",
              marks: []
            }
          ]
        }
      ],
      sections: [{ id: "section-1", name: "Opening", firstSlideId: "slide-1" }]
    };
    const current = bodyOf(body, "test");
    assert.equal(current.resource, "slides");
    if (current.resource !== "slides") throw new Error("expected a slide template");
    assert.equal(current.layouts[0].id, "layout-title");
    assert.equal(current.slides[0].elements[0].content.type, "text");
    assert.doesNotThrow(() => bodyOf(current, "current"));

    const compound = bodyOf(
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        element.content = {
          type: "group",
          children: [
            {
              id: "background-element",
              frame: { x: 0, y: 0, width: 1, height: 1 },
              paint: { fill: "paper", stroke: { color: "rule", width: 1, dash: "solid" } },
              locked: true,
              content: { type: "shape", shape: "rectangle" }
            },
            {
              id: "text-element",
              frame: { x: 0.1, y: 0.1, width: 0.8, height: 0.35 },
              content: {
                type: "text",
                block: {
                  id: "group-text-block",
                  type: "text",
                  variant: "paragraph",
                  atoms: [{ id: "group-text-atom", kind: "literal", text: "Evidence" }],
                  display: "Evidence",
                  marks: []
                }
              }
            },
            {
              id: "prompt-element",
              frame: { x: 0.1, y: 0.55, width: 0.8, height: 0.35 },
              content: {
                type: "prompt",
                block: {
                  id: "prompt-block",
                  type: "prompt",
                  atoms: [{ id: "prompt-atom", kind: "literal", text: "Summarize" }],
                  display: "Summarize",
                  marks: [],
                  scope: { include: [{ select: "project" }], exclude: [] },
                  state: "idle"
                }
              }
            }
          ]
        };
      }),
      "compound"
    );
    if (compound.resource !== "slides") throw new Error("expected a slide template");
    const compoundContent = compound.slides[0].elements[0].content;
    assert.equal(compoundContent.type, "group");
    if (compoundContent.type !== "group") throw new Error("expected grouped content");
    assert.deepEqual(
      compoundContent.children.map((child) => child.content.type),
      ["shape", "text", "prompt"]
    );
    assert.equal(
      bodyOf(
        changed(body, (draft) => {
          const slide = fields(entries(draft.slides)[0]);
          const element = fields(entries(slide.elements)[0]);
          fields(element.frame).x = 0.9;
          fields(element.frame).width = 0.4;
        }),
        "test"
      ).resource,
      "slides"
    );

    const malformed = [
      changed(body, (draft) => {
        fields(entries(draft.layouts)[0]).invented = true;
      }),
      changed(body, (draft) => {
        const layout = fields(entries(draft.layouts)[0]);
        fields(entries(layout.placeholders)[0]).styleKey = "missing";
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        fields(entries(slide.elements)[0]).overflow = "visible";
      }),
      changed(body, (draft) => {
        fields(entries(draft.slides)[0]).layoutKey = "missing";
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        fields(entries(slide.elements)[0]).fromPlaceholder = "missing";
      }),
      changed(body, (draft) => {
        fields(entries(draft.sections)[0]).firstSlideId = "missing";
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        fields(element.frame).width = Number.POSITIVE_INFINITY;
      }),
      changed(body, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const notes = fields(entries(slide.notes)[0]);
        notes.id = "slide-block";
      }),
      changed(current, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        fields(element.content).invented = true;
      }),
      changed(current, (draft) => {
        fields(entries(draft.layouts)[0]).id = "";
      }),
      changed(current, (draft) => {
        const slide = fields(entries(draft.slides)[0]);
        const element = fields(entries(slide.elements)[0]);
        const content = fields(element.content);
        element.blocks = [content.block];
        delete element.content;
      })
    ];
    for (const candidate of malformed) {
      assert.throws(() => bodyOf(candidate, "test"), /body is not a valid slides/);
    }
  });

  test("validates spreadsheet cell shapes, values, formats, and ordered bounded ranges", () => {
    assert.equal(bodyOf(spreadsheetBody, "test").resource, "spreadsheet");

    const malformed = [
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).invented = true;
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).value = { kind: "number", value: Number.NaN };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).value = { kind: "number", value: 42, invented: true };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).format = { invented: true };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(fields(draft.cells).B2).merge = "A1";
      }),
      changed(spreadsheetBody, (draft) => {
        const cells = fields(draft.cells);
        cells.IW1 = {};
      }),
      changed(spreadsheetBody, (draft) => {
        const rule = fields(entries(draft.formatRules)[0]);
        rule.from = "B2";
        rule.to = "A1";
      }),
      changed(spreadsheetBody, (draft) => {
        const print = fields(draft.print);
        print.area = { from: "C8", to: "A1" };
      }),
      changed(spreadsheetBody, (draft) => {
        fields(draft.print).repeatRows = "2:1";
      }),
      changed(spreadsheetBody, (draft) => {
        fields(draft.print).invented = true;
      })
    ];
    for (const candidate of malformed) {
      assert.throws(() => bodyOf(candidate, "test"), /body is not a valid spreadsheet/);
    }
  });

  test("keeps body variable lookup exact when declarations differ only by case", async () => {
    model.tables.templates.push(
      template(
        "1",
        "u",
        {
          resource: "document",
          rows: [
            {
              id: "row",
              kind: "blocks",
              blocks: [
                {
                  id: "prompt",
                  type: "prompt",
                  atoms: [],
                  display: "",
                  marks: [],
                  scope: {
                    include: [{ select: "variable", name: "Region" }],
                    exclude: []
                  },
                  state: "idle"
                }
              ]
            }
          ]
        },
        {
          variables: [
            {
              name: "region",
              label: "Region",
              default: { include: [{ select: "project" }], exclude: [] }
            }
          ]
        }
      )
    );

    const answer = await instantiateTemplate({ templateId: "templates:1" });

    assert.equal(answer.accepted, false);
    assert.equal(answer.accepted ? "" : answer.reason, "variables-required");
    assert.deepEqual(answer.accepted ? [] : answer.variables, ["Region"]);
  });
});
