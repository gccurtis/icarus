import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  projectId: "projects:mine",
  tables: new Map<string, unknown>(),
  writes: [] as { table: string; fields: Record<string, unknown> }[],
  updates: [] as { path: string; value: unknown }[]
}));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: model.projectId, userId: "users:me", username: "Me" })
}));

vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => {
    const unit = {
      create: (table: string, fields: Record<string, unknown>) => {
        model.writes.push({ table, fields });
        return `${table}:new`;
      },
      update: (path: string, value: unknown) => {
        model.updates.push({ path, value });
      },
      read: (table: string) => ({
        table,
        kind: "table",
        rows: model.tables.get(table) ?? []
      })
    };
    return { store: { ...unit, transaction: (work: (inside: typeof unit) => unknown) => work(unit) } };
  }
}));

const { readProjectResourceIndex } = await import(
  "$capabilities/project-resources/api/read-project-resource-index/read-project-resource-index"
);

beforeEach(() => {
  model.tables.clear();
  model.writes.length = 0;
  model.updates.length = 0;
});

const { createProjectResource } = await import(
  "$capabilities/project-resources/api/create-project-resource/create-project-resource"
);
const { renameProjectResource } = await import(
  "$capabilities/project-resources/api/rename-project-resource/rename-project-resource"
);

const titledResource = (
  table: "documents" | "presentations" | "spreadsheets",
  suffix: string,
  projectId: string,
  title: string
) => ({
  _id: `${table}:${suffix}`,
  _creationTime: 1,
  projectId,
  title,
  createdBy: { kind: "system" as const },
  updatedBy: { kind: "system" as const },
  updatedAt: 1
});

describe("createProjectResource", () => {
  it("derives document project and actor, then writes a leader body", async () => {
    const result = await createProjectResource({ target: "document", title: "  Memo  " });

    expect(result).toMatchObject({
      accepted: true,
      target: "document",
      resourceId: "documents:new",
      title: "Memo",
      revision: 0
    });
    expect(model.writes).toHaveLength(4);
    expect(model.writes[0]).toMatchObject({
      table: "documents",
      fields: {
        projectId: "projects:mine",
        title: "Memo",
        createdBy: { kind: "user", userId: "users:me" },
        updatedBy: { kind: "user", userId: "users:me" }
      }
    });
    expect(model.writes[1]).toMatchObject({
      table: "documentSnapshots",
      fields: {
        projectId: "projects:mine",
        resourceId: "documents:new",
        revision: 0,
        role: "leader",
        body: {
          rows: [
            {
              kind: "blocks",
              blocks: [
                {
                  type: "text",
                  variant: "paragraph",
                  atoms: [{ kind: "literal", text: "" }],
                  display: "",
                  marks: []
                }
              ]
            }
          ]
        }
      }
    });
    const snapshot = model.writes[1].fields.body as {
      rows: { id: string; blocks: { id: string; atoms: { id: string }[] }[] }[];
    };
    expect(snapshot.rows[0].id).toMatch(/^row-[0-9a-f-]{36}$/);
    expect(snapshot.rows[0].blocks[0].id).toMatch(/^block-[0-9a-f-]{36}$/);
    expect(snapshot.rows[0].blocks[0].atoms[0].id).toMatch(/^atom-[0-9a-f-]{36}$/);
    expect(model.writes.slice(2).map((write) => write.table)).toEqual([
      "semanticSyncJobs",
      "semanticMaterialJobs"
    ]);
  });

  it("creates an editor-ready empty presentation", async () => {
    await createProjectResource({ target: "presentation", title: "Briefing" });

    expect(model.writes[0]).toMatchObject({
      table: "presentations",
      fields: {
        projectId: "projects:mine",
        createdBy: { kind: "user", userId: "users:me" }
      }
    });
    expect(model.writes[1]).toMatchObject({
      table: "presentationSnapshots",
      fields: {
        body: {
          aspectRatio: "16:9",
          slides: [{ elements: [], notes: [] }],
          sections: []
        }
      }
    });
    const snapshot = model.writes[1].fields.body as {
      slides: { id: string }[];
    };
    expect(snapshot.slides[0].id).toMatch(/^slide-[0-9a-f-]{36}$/);
  });

  it("creates an editor-ready empty spreadsheet", async () => {
    const result = await createProjectResource({ target: "spreadsheet", title: "Forecast" });

    expect(result).toMatchObject({
      accepted: true,
      target: "spreadsheet",
      resourceId: "spreadsheets:new",
      title: "Forecast",
      revision: 0
    });
    expect(model.writes[0]).toMatchObject({
      table: "spreadsheets",
      fields: {
        projectId: "projects:mine",
        title: "Forecast",
        createdBy: { kind: "user", userId: "users:me" }
      }
    });
    expect(model.writes[1]).toMatchObject({
      table: "spreadsheetSnapshots",
      fields: {
        projectId: "projects:mine",
        resourceId: "spreadsheets:new",
        revision: 0,
        role: "leader",
        part: 0
      }
    });
    const body = model.writes[1].fields.body as {
      rows: unknown[];
      columns: unknown[];
      styles: { defaultKey: string };
    };
    expect(body.rows).toHaveLength(100);
    expect(body.columns).toHaveLength(100);
    expect(body.styles.defaultKey).toBe("body");
  });

  it("allocates the first free project-local Untitled suffix when title is omitted", async () => {
    model.tables.set("documents", [
      titledResource("documents", "1", "projects:mine", "Untitled document 1"),
      titledResource("documents", "2", "projects:mine", "Untitled document 2"),
      titledResource("documents", "4", "projects:mine", "Untitled document 4"),
      titledResource("documents", "foreign", "projects:other", "Untitled document 3"),
      titledResource("documents", "lower", "projects:mine", "untitled document 3")
    ]);

    const document = await createProjectResource({ target: "document" });
    expect(document.title).toBe("Untitled document 3");
    expect(model.writes[0]).toMatchObject({
      table: "documents",
      fields: { projectId: "projects:mine", title: "Untitled document 3" }
    });

    model.writes.length = 0;
    model.tables.set("presentations", [
      titledResource("presentations", "1", "projects:mine", "Untitled presentation 1"),
      titledResource("presentations", "3", "projects:mine", "Untitled presentation 3")
    ]);
    const presentation = await createProjectResource({ target: "presentation" });
    expect(presentation.title).toBe("Untitled presentation 2");
    expect(model.writes[0]).toMatchObject({
      table: "presentations",
      fields: { projectId: "projects:mine", title: "Untitled presentation 2" }
    });

    model.writes.length = 0;
    model.tables.set("spreadsheets", [
      titledResource("spreadsheets", "1", "projects:mine", "Untitled spreadsheet 1"),
      titledResource("spreadsheets", "3", "projects:mine", "Untitled spreadsheet 3")
    ]);
    const spreadsheet = await createProjectResource({ target: "spreadsheet" });
    expect(spreadsheet.title).toBe("Untitled spreadsheet 2");
    expect(model.writes[0]).toMatchObject({
      table: "spreadsheets",
      fields: { projectId: "projects:mine", title: "Untitled spreadsheet 2" }
    });
  });

  it("refuses unsupported targets, malformed optional titles, and extra fields before writing", async () => {
    await expect(createProjectResource({ target: "analysis", title: "Graph" })).rejects.toThrow(
      /target is document, slides, or spreadsheet/
    );
    await expect(createProjectResource({ target: "document", title: "  " })).rejects.toThrow(
      /1 to 160/
    );
    await expect(
      createProjectResource({ target: "document", title: undefined })
    ).rejects.toThrow(/only target and title/);
    await expect(
      createProjectResource({ target: "document", title: "x".repeat(161) })
    ).rejects.toThrow(/1 to 160/);
    await expect(
      createProjectResource({
        target: "document",
        title: "Forged",
        projectId: "projects:other"
      })
    ).rejects.toThrow(/only target and title/);
    expect(model.writes).toEqual([]);
  });

  it("rejects non-data input shapes without invoking accessors", async () => {
    const inherited = Object.assign(Object.create({ retired: true }), { target: "document" });
    await expect(createProjectResource(inherited)).rejects.toThrow(/only target and title/);

    const hidden = { target: "document" };
    Object.defineProperty(hidden, "retired", { enumerable: false, value: true });
    await expect(createProjectResource(hidden)).rejects.toThrow(/only target and title/);

    const symbolic = { target: "document", [Symbol("retired")]: true };
    await expect(createProjectResource(symbolic)).rejects.toThrow(/only target and title/);

    let reads = 0;
    const accessor = {} as Record<string, unknown>;
    Object.defineProperty(accessor, "target", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "document";
      }
    });
    await expect(createProjectResource(accessor)).rejects.toThrow(/only target and title/);
    expect(reads).toBe(0);
  });
});

describe("readProjectResourceIndex", () => {
  const system = { kind: "system" as const };
  const editable = (
    table: "documents" | "presentations" | "spreadsheets",
    suffix: string,
    extra: Record<string, unknown> = {}
  ) => ({
    _id: `${table}:${suffix}`,
    _creationTime: 1,
    projectId: "projects:mine",
    title: suffix,
    createdBy: system,
    updatedBy: system,
    updatedAt: 10,
    ...extra
  });

  const exactUser = (id: string, name: string) => ({
    _id: id,
    _creationTime: 1,
    authSubject: `auth:${id}`,
    displayName: name,
    settings: "{}",
    updatedAt: 2
  });

  const exactMembership = (id: string, projectId: string, userId: string) => ({
    _id: id,
    _creationTime: 1,
    projectId,
    userId,
    token: `token:${id}`,
    role: "editor"
  });

  it("fails closed on malformed table roots and rows", async () => {
    model.tables.set("documents", { not: "an array" });

    await expect(readProjectResourceIndex()).rejects.toThrow(/table is an array/);

    model.tables.set("documents", [null, 7, "row"]);
    await expect(readProjectResourceIndex()).rejects.toThrow(/row.*object/);
  });

  it("lists exact current rows and fails closed on an unknown resource field", async () => {
    model.tables.set("documents", [
      editable("documents", "mine", {
        title: "Mine",
        updatedBy: { kind: "user", userId: "users:me" }
      }),
      editable("documents", "other", { projectId: "projects:other", title: "Other" })
    ]);
    model.tables.set("spreadsheets", [
      editable("spreadsheets", "mine", {
        title: "Model",
        updatedAt: 8,
        updatedBy: { kind: "user", userId: "users:me" }
      })
    ]);
    model.tables.set("users", [exactUser("users:me", "Me")]);
    model.tables.set("memberships", [
      exactMembership("memberships:me", "projects:mine", "users:me")
    ]);

    const result = await readProjectResourceIndex();

    expect(result.resources.map((row) => row.id)).toEqual([
      "documents:mine",
      "spreadsheets:mine"
    ]);
    expect(result.resources[0]).toEqual({
      id: "documents:mine",
      ref: { kind: "document", id: "documents:mine" },
      kind: "document",
      name: "Mine",
      relativePath: null,
      updatedAt: 10,
      updatedByName: "Me"
    });
    expect(result.unavailable).toEqual([]);

    model.tables.set("documents", [
      editable("documents", "mine"),
      editable("documents", "unknown", { unknownField: true })
    ]);
    await expect(readProjectResourceIndex()).rejects.toThrow(/unknown field/);
  });

  it("projects an external file with a file label and its exact represented subkind", async () => {
    const hash = "a".repeat(64);
    model.tables.set("externalFiles", [{
      _id: "externalFiles:source",
      _creationTime: 1,
      projectId: "projects:mine",
      name: "analysis.ts",
      originalName: "analysis.ts",
      relativePath: "sources/analysis.ts",
      mediaType: "text/typescript",
      subkind: "code",
      storageId: `_storage:${hash}`,
      hash,
      size: 42,
      origin: { kind: "upload" },
      createdBy: system,
      updatedBy: system,
      revision: 1,
      updatedAt: 10
    }]);

    await expect(readProjectResourceIndex()).resolves.toEqual({
      resources: [{
        id: "externalFiles:source",
        ref: { kind: "externalFile::code", id: "externalFiles:source" },
        kind: "file",
        name: "analysis.ts",
        relativePath: "sources/analysis.ts",
        updatedAt: 10,
        updatedByName: "Icarus"
      }],
      unavailable: []
    });
  });

  it("fails closed on malformed scoped rows and never forwards actor extras", async () => {
    model.tables.set("documents", [
      editable("documents", "good", { title: "Good" }),
      editable("documents", "bad.actor", {
        title: "Bad",
        updatedBy: { kind: "user", userId: "users:me", credential: "do-not-forward" }
      }),
      editable("documents", "bad-time", {
        title: "Bad time",
        updatedAt: Number.POSITIVE_INFINITY
      }),
      editable("documents", "foreign-actor", {
        title: "Former collaborator",
        updatedAt: 12,
        updatedBy: { kind: "user", userId: "users:other" }
      }),
      editable("documents", "good", { title: "Duplicate id", updatedAt: 13 })
    ]);
    model.tables.set("users", [exactUser("users:other", "Other secret")]);
    model.tables.set("memberships", [
      exactMembership("memberships:other", "projects:other", "users:other")
    ]);

    await expect(readProjectResourceIndex()).rejects.toThrow();
  });

  it("rejects a malformed duplicate row id rather than exposing either claimant", async () => {
    model.tables.set("documents", [
      editable("documents", "duplicate", { title: "" }),
      editable("documents", "duplicate", { title: "Looks valid", updatedAt: 11 })
    ]);

    await expect(readProjectResourceIndex()).rejects.toThrow();
  });

  it("fails closed when a foreign row claims the same canonical id", async () => {
    model.tables.set("documents", [
      editable("documents", "shared-path", { title: "Mine" }),
      editable("documents", "shared-path", {
        projectId: "projects:other",
        title: "Foreign",
        updatedAt: 11
      })
    ]);

    await expect(readProjectResourceIndex()).rejects.toThrow(/repeats row id/);
  });

  it("keeps unavailable historical actors null and resolves exact related subjects", async () => {
    model.tables.set("documents", [
      editable("documents", "user", {
        title: "User work",
        updatedBy: { kind: "user", userId: "users:former" }
      })
    ]);
    model.tables.set("presentations", [
      editable("presentations", "connector", {
        title: "Connector work",
        updatedAt: 11,
        updatedBy: { kind: "connector", connectorId: "connectors:exact" }
      })
    ]);
    model.tables.set("connectors", [
      {
        _id: "connectors:exact",
        _creationTime: 1,
        projectId: "projects:mine",
        name: "Drive source",
        configuration: {
          kind: "provider",
          provider: "googleDrive",
          selection: "folder:board"
        },
        createdBy: system,
        updatedAt: 2
      }
    ]);

    const result = await readProjectResourceIndex();

    expect(result.resources.map((row) => row.updatedByName)).toEqual([
      null,
      "Drive source"
    ]);
  });

  it("fails closed on a malformed partial stage", async () => {
    model.tables.set("documents", [editable("documents", "stage")]);
    model.tables.set("templateStages", [
      {
        _id: "templateStages:bad",
        projectId: "projects:mine",
        resourceId: "documents:stage"
      }
    ]);

    await expect(readProjectResourceIndex()).rejects.toThrow();
  });
});

describe("renameProjectResource", () => {
  const system = { kind: "system" as const };
  const exact = (extra: Record<string, unknown> = {}) => ({
    _id: "documents:rename",
    _creationTime: 1,
    projectId: "projects:mine",
    title: "Before",
    summary: "Kept",
    createdBy: system,
    updatedBy: system,
    updatedAt: 2,
    ...extra
  });

  it("replaces an admitted row with explicitly named current fields", async () => {
    model.tables.set("documents", [exact()]);

    await expect(renameProjectResource({
      resourceId: "documents:rename",
      title: "After"
    })).resolves.toMatchObject({ resourceId: "documents:rename", title: "After" });

    expect(model.updates).toHaveLength(1);
    expect(model.updates[0].path).toBe("documents.documents:rename");
    expect(model.updates[0].value).toEqual({
      projectId: "projects:mine",
      title: "After",
      summary: "Kept",
      createdBy: system,
      updatedBy: { kind: "user", userId: "users:me" },
      updatedAt: expect.any(Number)
    });
  });

  it("refuses unknown, incomplete, duplicate, and foreign row claimants", async () => {
    const ask = { resourceId: "documents:rename", title: "After" };

    model.tables.set("documents", [exact({ unknownField: true })]);
    await expect(renameProjectResource(ask)).rejects.toThrow(/unknown field/);

    model.tables.set("documents", [exact(), exact()]);
    await expect(renameProjectResource(ask)).rejects.toThrow(/repeats row id/);

    model.tables.set("documents", [exact({ projectId: "projects:other" })]);
    await expect(renameProjectResource(ask)).rejects.toThrow(/no resource/);
    expect(model.updates).toEqual([]);
  });

  it("rejects non-data commands and non-nominal resource identities", async () => {
    await expect(renameProjectResource({ resourceId: "externalFiles:rename", title: "After" }))
      .rejects.toThrow(/current editable resource id/);
    await expect(renameProjectResource({ resourceId: "documents:rename", title: undefined } as never))
      .rejects.toThrow(/exact current data object/);

    let reads = 0;
    const accessor = { resourceId: "documents:rename" } as Record<string, unknown>;
    Object.defineProperty(accessor, "title", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "After";
      }
    });
    await expect(renameProjectResource(accessor)).rejects.toThrow(/exact current data object/);
    expect(reads).toBe(0);
  });
});
