import { beforeEach, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

export type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const fixtureModel = vi.hoisted(() => ({
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

export const model = fixtureModel;

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve(model.scope)
}));

export const { openTemplateStage } = await import(
  "$capabilities/templates/api/open-template-stage/open-template-stage"
);
export const { commitTemplateStage } = await import(
  "$capabilities/templates/api/commit-template-stage/commit-template-stage"
);
export const { discardTemplateStage } = await import(
  "$capabilities/templates/api/discard-template-stage/discard-template-stage"
);
export const { enqueueSemanticSync } = await import("$capabilities/semantic-overlay/index");
export const { readResourceTemplate } = await import(
  "$capabilities/templates/api/read-resource-template/read-resource-template"
);
export const { readTemplateStageIndex } = await import(
  "$capabilities/templates/api/read-template-stage-index/read-template-stage-index"
);
export const { readTemplateLibrary } = await import(
  "$capabilities/templates/api/read-template-library/read-template-library"
);
export const { readTemplate } = await import("$capabilities/templates/api/read-template/read-template");
export const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);
export const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);

export const text = (id: string, display: string) => ({
  id,
  type: "text",
  variant: "paragraph",
  atoms: [{ id: `${id}-a`, kind: "literal", text: display }],
  display,
  marks: []
});

export const documentBody = {
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks: [text("b1", "Incident write-up")] }]
};

export const deckBody = {
  resource: "slides",
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  slides: [{ id: "s1", elements: [], notes: [] }],
  sections: []
};

export const row = (table: string, id: string, fields: Record<string, unknown>): Row => {
  const defaults = table === "documents" || table === "slideDecks" || table === "spreadsheets"
    ? {
        createdBy: { kind: "system" },
        updatedBy: { kind: "system" },
        updatedAt: 1
      }
    : table === "documentSnapshots" || table === "slideDeckSnapshots" || table === "spreadsheetSnapshots"
      ? { part: 0, at: 1 }
      : table === "derivedOutputs"
        ? {
            definitionRevision: 1,
            valueSource: "none",
            queries: [],
            evidence: [],
            state: "idle",
            createdBy: { kind: "system" },
            updatedAt: 1
          }
        : {};
  return {
    ...defaults,
    ...fields,
    _id: `${table}:${id}`,
    _creationTime: 1
  };
};

export const template = (id: string, body: unknown = documentBody, extra: Record<string, unknown> = {}): Row =>
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
