import { beforeEach, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

export type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const fixtureModel = vi.hoisted(() => ({
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

export const model = fixtureModel;

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve(model.scope)
}));

export const { createTemplateFromResource } = await import(
  "$capabilities/templates/api/create-template-from-resource/create-template-from-resource"
);
export const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);
export const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);
export const { writeTemplateVersion } = await import(
  "$capabilities/templates/api/shared/template-rows"
);

export const prompt = (id: string, name: string) => ({
  id,
  type: "prompt",
  atoms: [{ id: `${id}-a`, kind: "literal", text: "Sum up" }],
  display: "Sum up",
  prompt: "Sum up",
  marks: [],
  scope: { include: [{ select: "hole", name }], exclude: [] },
  state: "idle"
});

export const linkedPrompt = (id: string, name: string, derivedOutputId: string) => {
  const { prompt: _prompt, scope: _scope, ...block } = prompt(id, name);
  void _prompt;
  void _scope;
  return { ...block, hole: { name }, derivedOutputId };
};

export const body = {
  resource: "document",
  rows: [{ id: "r1", kind: "blocks", blocks: [prompt("p1", "evidence")] }]
};

export const row = (table: string, id: string, fields: Record<string, unknown>): Row => {
  const defaults = table === "documents" || table === "presentations" || table === "spreadsheets"
    ? {
        createdBy: { kind: "system" },
        updatedBy: { kind: "system" },
        updatedAt: 1
      }
    : table === "documentSnapshots" || table === "presentationSnapshots" || table === "spreadsheetSnapshots"
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

export const scopeOf = (held: Row) => {
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
    presentations: [],
    presentationSnapshots: [],
    spreadsheets: []
  };
});
