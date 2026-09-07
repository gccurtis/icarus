import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => ({
  projectId: "projects:mine",
  tables: new Map<string, unknown>(),
  writes: [] as { table: string; fields: Record<string, unknown> }[]
}));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: model.projectId, userId: "users:me", username: "Me" })
}));

vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => ({
    store: {
      create: (table: string, fields: Record<string, unknown>) => {
        model.writes.push({ table, fields });
        return `${table}:new`;
      },
      read: (table: string) => ({
        table,
        kind: "table",
        rows: model.tables.get(table) ?? []
      })
    }
  })
}));

const { readProjectResourceIndex } = await import(
  "$capabilities/project-resources/api/read-project-resource-index/read-project-resource-index"
);

beforeEach(() => {
  model.tables.clear();
  model.writes.length = 0;
});

const { createProjectResource } = await import(
  "$capabilities/project-resources/api/create-project-resource/create-project-resource"
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
    expect(model.writes).toHaveLength(2);
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
  });

  it("refuses unsupported targets, malformed optional titles, and extra fields before writing", async () => {
    await expect(createProjectResource({ target: "spreadsheet", title: "Sheet" })).rejects.toThrow(
      /target is document or slides/
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
  it("treats a malformed table root as unavailable input rather than crashing", async () => {
    model.tables.set("documents", { not: "an array" });

    await expect(readProjectResourceIndex()).resolves.toEqual({ resources: [], unavailable: [] });
  });

  it("returns only listable rows in the resolved project", async () => {
    model.tables.set("documents", [
      {
        _id: "documents:mine",
        projectId: "projects:mine",
        title: "Mine",
        templateId: "templates:secret",
        updatedAt: 10,
        updatedBy: { kind: "user", userId: "users:me" }
      },
      {
        _id: "documents:other",
        projectId: "projects:other",
        title: "Other",
        updatedAt: 9,
        updatedBy: { kind: "user", userId: "users:other" }
      }
    ]);
    model.tables.set("spreadsheets", [
      {
        _id: "spreadsheets:mine",
        projectId: "projects:mine",
        title: "Model",
        updatedAt: 8,
        updatedBy: { kind: "user", userId: "users:me" }
      }
    ]);
    model.tables.set("templateVersions", [
      { _id: "templateVersions:secret", templateId: "templates:other", body: {} }
    ]);
    model.tables.set("users", [
      { _id: "users:me", displayName: "Me" },
      { _id: "users:other", displayName: "Other" }
    ]);
    model.tables.set("memberships", [
      { _id: "memberships:me", projectId: "projects:mine", userId: "users:me" }
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
    expect("templateId" in result.resources[0]).toBe(false);
    expect("templateVersions" in result).toBe(false);
    expect(result.unavailable).toEqual([]);
  });

  it("quarantines malformed scoped rows and never forwards actor extras", async () => {
    model.tables.set("documents", [
      {
        _id: "documents:good",
        projectId: "projects:mine",
        title: "Good",
        updatedAt: 10,
        updatedBy: { kind: "system" }
      },
      {
        _id: "documents:bad.actor",
        projectId: "projects:mine",
        title: "Bad",
        updatedAt: 11,
        updatedBy: { kind: "user", userId: "users:me", credential: "do-not-forward" }
      },
      {
        _id: "documents:bad-time",
        projectId: "projects:mine",
        title: "Bad time",
        updatedAt: Number.POSITIVE_INFINITY,
        updatedBy: { kind: "system" }
      },
      {
        _id: "documents:foreign-actor",
        projectId: "projects:mine",
        title: "Former collaborator",
        updatedAt: 12,
        updatedBy: { kind: "user", userId: "users:other" }
      },
      {
        _id: "documents:good",
        projectId: "projects:mine",
        title: "Duplicate id",
        updatedAt: 13,
        updatedBy: { kind: "system" }
      }
    ]);
    model.tables.set("users", [{ _id: "users:other", displayName: "Other secret" }]);
    model.tables.set("memberships", [
      { _id: "memberships:other", projectId: "projects:other", userId: "users:other" }
    ]);

    const result = await readProjectResourceIndex();

    expect(result.resources).toEqual([
      {
        id: "documents:foreign-actor",
        kind: "document",
        name: "Former collaborator",
        updatedAt: 12,
        updatedByName: "Someone"
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
      {
        _id: "documents:duplicate",
        projectId: "projects:mine",
        title: "",
        updatedAt: 10,
        updatedBy: { kind: "system" }
      },
      {
        _id: "documents:duplicate",
        projectId: "projects:mine",
        title: "Looks valid",
        updatedAt: 11,
        updatedBy: { kind: "system" }
      }
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
      {
        _id: "documents:shared-path",
        projectId: "projects:mine",
        title: "Mine",
        updatedAt: 10,
        updatedBy: { kind: "system" }
      },
      {
        _id: "documents:shared-path",
        projectId: "projects:other",
        title: "Foreign",
        updatedAt: 11,
        updatedBy: { kind: "system" }
      }
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

  it("falls back when referenced actor labels are noncanonical or overlong", async () => {
    model.tables.set("documents", [
      {
        _id: "documents:user",
        projectId: "projects:mine",
        title: "User work",
        updatedAt: 10,
        updatedBy: { kind: "user", userId: "users:odd" }
      }
    ]);
    model.tables.set("slideDecks", [
      {
        _id: "slideDecks:connector",
        projectId: "projects:mine",
        title: "Connector work",
        updatedAt: 11,
        updatedBy: { kind: "connector", connectorId: "connectors:odd" }
      }
    ]);
    model.tables.set("researchThreads", [
      {
        _id: "researchThreads:agent",
        projectId: "projects:mine",
        title: "Agent work",
        updatedAt: 12,
        createdBy: { kind: "agent", taskId: "agentTasks:odd" }
      }
    ]);
    model.tables.set("memberships", [
      { _id: "memberships:odd", projectId: "projects:mine", userId: "users:odd" }
    ]);
    model.tables.set("users", [{ _id: "users:odd", displayName: "x".repeat(161) }]);
    model.tables.set("connectors", [
      {
        _id: "connectors:odd",
        projectId: "projects:mine",
        name: " Padded connector "
      }
    ]);
    model.tables.set("agentTasks", [
      {
        _id: "agentTasks:odd",
        projectId: "projects:mine",
        title: "x".repeat(161)
      }
    ]);

    const result = await readProjectResourceIndex();

    expect(result.resources.map((row) => row.updatedByName)).toEqual([
      "Someone",
      "A connector",
      "An agent"
    ]);
  });
});
