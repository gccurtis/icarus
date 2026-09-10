import { beforeEach, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

export type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const fixtureModel = vi.hoisted(() => ({
  calls: [] as string[],
  scope: { projectId: "projects:p", userId: "users:u", username: "Uma" },
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
  requireScope: () => {
    model.calls.push("scope");
    return Promise.resolve(model.scope);
  }
}));

export const { createTemplate } = await import(
  "$capabilities/templates/api/create-template/create-template"
);
export const { duplicateTemplate } = await import(
  "$capabilities/templates/api/duplicate-template/duplicate-template"
);
export const { instantiateTemplate } = await import(
  "$capabilities/templates/api/instantiate-template/instantiate-template"
);
export const { readTemplate } = await import(
  "$capabilities/templates/api/read-template/read-template"
);
export const { readTemplateLibrary } = await import(
  "$capabilities/templates/api/read-template-library/read-template-library"
);
export const { removeTemplate } = await import(
  "$capabilities/templates/api/remove-template/remove-template"
);
export const { updateTemplate } = await import(
  "$capabilities/templates/api/update-template/update-template"
);
export const { fieldsOf, tagsOf } = await import(
  "$capabilities/templates/api/shared/validation"
);
export const { bodyOf } = await import(
  "$capabilities/templates/api/shared/body-validation/body-validation"
);
export const { answersOf, holesOf } = await import(
  "$capabilities/templates/api/shared/hole-validation"
);
export const { validateCreateTemplate } = await import(
  "$capabilities/templates/api/create-template/validate-create-template"
);
export const { normalizeScope } = await import(
  "$capabilities/templates/api/shared/scopes"
);
export const { withFreshOutputs } = await import(
  "$capabilities/templates/api/shared/prompts"
);

export const documentBody = { resource: "document", rows: [] } as const;
export const slidesBody = {
  resource: "slides",
  aspectRatio: "16:9",
  theme: { colors: { text: "ink", accent: "blue" } },
  styles: { defaultKey: "body", styles: { body: { name: "Body" } } },
  layouts: [],
  slides: [],
  sections: []
} as const;
export const spreadsheetBody = {
  resource: "spreadsheet",
  cells: {
    B2: { value: { kind: "number", value: 42 }, merge: "C2" },
    A1: { expression: "=B2*2" }
  },
  columnWidths: { B: 140 },
  rowHeights: { "2": 30 },
  formatRules: [{ id: "format-rule-money", from: "A1", to: "B2", style: "money" }],
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
  styles: {
    defaultKey: "body",
    styles: { body: { name: "Body" }, money: { name: "Money" } }
  }
} as const;

export const row = (table: string, id: string, fields: Record<string, unknown>): Row => ({
  ...fields,
  _id: table === "users" ? id : `${table}:${id}`,
  _creationTime: typeof fields._creationTime === "number" ? fields._creationTime : 1
});

export const template = (
  id: string,
  owner: string,
  body: unknown = documentBody,
  extra: Record<string, unknown> = {}
): Row =>
  row("templates", id, {
    projectId: "projects:p",
    userId: owner,
    name: `Template ${id}`,
    tags: ["Useful"],
    body,
    holes: [],
    createdBy: { kind: "user", userId: owner },
    revision: 2,
    updatedAt: 20,
    ...extra
  });

export const templateVersion = (
  id: string,
  templateId = "templates:1",
  revision = 1,
  extra: Record<string, unknown> = {}
): Row => row("templateVersions", id, {
  templateId,
  revision,
  name: `Template revision ${revision}`,
  tags: [],
  body: documentBody,
  holes: [],
  at: 1,
  ...extra
});

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(500);
  model.calls.length = 0;
  model.scope = { projectId: "projects:p", userId: "users:u", username: "Uma" };
  model.tables = {
    users: [
      row("users", "users:u", { displayName: "Uma", authSubject: "users:u", settings: "{}", updatedAt: 1 }),
      row("users", "users:v", { displayName: "Victor", authSubject: "users:v", settings: "{}", updatedAt: 1 }),
      row("users", "users:x", { displayName: "Xavier", authSubject: "users:x", settings: "{}", updatedAt: 1 })
    ],
    memberships: [
      row("memberships", "1", { userId: "users:u", projectId: "projects:p", token: "users:u", role: "owner" }),
      row("memberships", "2", { userId: "users:v", projectId: "projects:p", token: "users:v", role: "editor" }),
      row("memberships", "3", { userId: "users:x", projectId: "projects:other", token: "x", role: "owner" })
    ],
    templates: [],
    templateVersions: [],
    resourceSets: [],
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


export const changed = (
  source: unknown,
  change: (draft: Record<string, unknown>) => void
): unknown => {
  const draft = structuredClone(source) as Record<string, unknown>;
  change(draft);
  return draft;
};

export const fields = (value: unknown): Record<string, unknown> =>
  value as Record<string, unknown>;

export const entries = (value: unknown): unknown[] => value as unknown[];
