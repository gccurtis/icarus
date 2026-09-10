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

  it("creates an editor-ready empty deck", async () => {
    await createProjectResource({ target: "slides", title: "Briefing" });

    expect(model.writes[0]).toMatchObject({
      table: "slideDecks",
      fields: {
        projectId: "projects:mine",
        createdBy: { kind: "user", userId: "users:me" }
      }
    });
    expect(model.writes[1]).toMatchObject({
      table: "slideDeckSnapshots",
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
      { projectId: "projects:mine", title: "Untitled document 1" },
      { projectId: "projects:mine", title: "Untitled document 2" },
      { projectId: "projects:mine", title: "Untitled document 4" },
      { projectId: "projects:other", title: "Untitled document 3" },
      { projectId: "projects:mine", title: "untitled document 3" }
    ]);

    const document = await createProjectResource({ target: "document" });
    expect(document.title).toBe("Untitled document 3");
    expect(model.writes[0]).toMatchObject({
      table: "documents",
      fields: { projectId: "projects:mine", title: "Untitled document 3" }
    });

    model.writes.length = 0;
    model.tables.set("slideDecks", [
      { projectId: "projects:mine", title: "Untitled deck 1" },
      { projectId: "projects:mine", title: "Untitled deck 3" }
    ]);
    const deck = await createProjectResource({ target: "slides" });
    expect(deck.title).toBe("Untitled deck 2");
    expect(model.writes[0]).toMatchObject({
      table: "slideDecks",
      fields: { projectId: "projects:mine", title: "Untitled deck 2" }
    });

    model.writes.length = 0;
    model.tables.set("spreadsheets", [
      { projectId: "projects:mine", title: "Untitled spreadsheet 1" },
      { projectId: "projects:mine", title: "Untitled spreadsheet 3" }
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
    ).rejects.toThrow(/when supplied/);
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
});

describe("readProjectResourceIndex", () => {
  const system = { kind: "system" as const };
  const editable = (
    table: "documents" | "slideDecks" | "spreadsheets",
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

  it("treats a malformed table root as unavailable input rather than crashing", async () => {
    model.tables.set("documents", { not: "an array" });

    await expect(readProjectResourceIndex()).resolves.toEqual({ resources: [], unavailable: [] });

    model.tables.set("documents", [null, 7, "row"]);
    await expect(readProjectResourceIndex()).resolves.toEqual({ resources: [], unavailable: [] });
  });

  it("lists exact current rows and quarantines an unknown resource field", async () => {
    model.tables.set("documents", [
      editable("documents", "mine", {
        title: "Mine",
        updatedBy: { kind: "user", userId: "users:me" }
      }),
      editable("documents", "unknown", { unknownField: true }),
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
      kind: "document",
      name: "Mine",
      updatedAt: 10,
      updatedByName: "Me"
    });
    expect(result.unavailable).toEqual([
      expect.objectContaining({ resourceId: "documents:unknown", reason: "corrupt" })
    ]);
  });

  it("quarantines malformed scoped rows and never forwards actor extras", async () => {
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

    const result = await readProjectResourceIndex();

    expect(result.resources).toEqual([
      {
        id: "documents:foreign-actor",
        kind: "document",
        name: "Former collaborator",
        updatedAt: 12,
        updatedByName: null
      }
    ]);
    expect(result.unavailable).toHaveLength(4);
    expect(result.unavailable.filter((row) => row.resourceId === "documents:good")).toHaveLength(
      2
    );
    expect(JSON.stringify(result)).not.toContain("do-not-forward");
    expect(JSON.stringify(result)).not.toContain("Other secret");
  });

  it("reserves a malformed row id so a valid-looking duplicate is never exposed", async () => {
    model.tables.set("documents", [
      editable("documents", "duplicate", { title: "" }),
      editable("documents", "duplicate", { title: "Looks valid", updatedAt: 11 })
    ]);

    const result = await readProjectResourceIndex();

    expect(result.resources).toEqual([]);
    expect(result.unavailable).toHaveLength(2);
    expect(result.unavailable.map((row) => row.resourceId)).toEqual([
      "documents:duplicate",
      "documents:duplicate"
    ]);
  });

  it("quarantines a scoped row when a foreign row claims the same canonical id", async () => {
    model.tables.set("documents", [
      editable("documents", "shared-path", { title: "Mine" }),
      editable("documents", "shared-path", {
        projectId: "projects:other",
        title: "Foreign",
        updatedAt: 11
      })
    ]);

    const result = await readProjectResourceIndex();

    expect(result.resources).toEqual([]);
    expect(result.unavailable).toEqual([
      {
        resourceId: "documents:shared-path",
        kind: "document",
        reason: "corrupt",
        detail: "documents id is unique"
      }
    ]);
    expect(JSON.stringify(result)).not.toContain("Foreign");
  });

  it("keeps unavailable historical actors null and resolves exact related subjects", async () => {
    model.tables.set("documents", [
      editable("documents", "user", {
        title: "User work",
        updatedBy: { kind: "user", userId: "users:former" }
      })
    ]);
    model.tables.set("slideDecks", [
      editable("slideDecks", "connector", {
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

  it("never hides a resource through a malformed partial stage", async () => {
    model.tables.set("documents", [editable("documents", "stage")]);
    model.tables.set("templateStages", [
      {
        _id: "templateStages:bad",
        projectId: "projects:mine",
        resourceId: "documents:stage"
      }
    ]);

    await expect(readProjectResourceIndex()).resolves.toMatchObject({
      resources: [],
      unavailable: [
        { resourceId: "documents:stage", reason: "corrupt" }
      ]
    });
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
    await expect(renameProjectResource(ask)).rejects.toThrow(/no resource/);

    model.tables.set("documents", [exact(), exact()]);
    await expect(renameProjectResource(ask)).rejects.toThrow(/no resource/);

    model.tables.set("documents", [exact({ projectId: "projects:other" })]);
    await expect(renameProjectResource(ask)).rejects.toThrow(/no resource/);
    expect(model.updates).toEqual([]);
  });
});
