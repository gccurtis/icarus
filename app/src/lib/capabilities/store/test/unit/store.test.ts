import { beforeEach, describe, expect, it, vi } from "vitest";

const model = vi.hoisted(() => {
  const calls: string[] = [];
  const rows: Record<string, Record<string, unknown>[]> = {
    projects: [
      { _id: "p", _creationTime: 1, name: "Mine", description: "Visible", settings: "secret" },
      { _id: "other", _creationTime: 1, name: "Theirs", description: "Hidden" }
    ],
    memberships: [
      {
        _id: "memberships:1",
        _creationTime: 1,
        projectId: "p",
        userId: "u",
        role: "owner",
        token: "mine-secret"
      },
      {
        _id: "memberships:2",
        _creationTime: 1,
        projectId: "p",
        userId: "friend",
        role: "editor",
        token: "friend-secret"
      },
      {
        _id: "memberships:3",
        _creationTime: 1,
        projectId: "other",
        userId: "stranger",
        role: "owner",
        token: "other-secret"
      }
    ],
    users: [
      {
        _id: "u",
        _creationTime: 1,
        displayName: "You",
        email: "you@example.test",
        authSubject: "auth|you",
        settings: "secret"
      },
      {
        _id: "friend",
        _creationTime: 1,
        displayName: "Friend",
        email: "friend@example.test"
      },
      { _id: "stranger", _creationTime: 1, displayName: "Stranger" }
    ],
    connectors: [
      {
        _id: "connectors:1",
        _creationTime: 1,
        projectId: "p",
        name: "Drive",
        credential: { kind: "oauth", token: "secret" }
      }
    ],
    documents: [
      {
        _id: "documents:1",
        _creationTime: 1,
        projectId: "p",
        title: "Visible",
        templateId: "templates:1"
      },
      {
        _id: "documents:2",
        _creationTime: 1,
        projectId: "other",
        title: "Hidden"
      }
    ],
    slideDecks: [
      { _id: "slideDecks:1", _creationTime: 1, projectId: "p", title: "Visible deck" },
      { _id: "slideDecks:2", _creationTime: 1, projectId: "other", title: "Hidden deck" }
    ],
    variables: [
      {
        _id: "variables:1",
        _creationTime: 1,
        projectId: "p",
        name: "Visible variable",
        value: { kind: "number", value: 4 },
        createdBy: { kind: "user", userId: "u" }
      },
      { _id: "variables:2", _creationTime: 1, projectId: "other", name: "Hidden variable" }
    ],
    personas: [
      { _id: "personas:1", _creationTime: 1, projectId: "p", name: "Visible persona" },
      { _id: "personas:2", _creationTime: 1, name: "Unscoped persona" },
      { _id: "personas:3", _creationTime: 1, projectId: "other", name: "Hidden persona" }
    ],
    templates: [
      { _id: "templates:1", _creationTime: 1, userId: "u", name: "Private template" }
    ],
    templateVersions: [
      { _id: "templateVersions:1", _creationTime: 1, templateId: "templates:1", revision: 1 }
    ],
    documentSnapshots: [
      { _id: "documentSnapshots:1", _creationTime: 1, projectId: "p", body: { pages: [] } }
    ]
  };

  const read = (path: string) => {
    calls.push(`read ${path}`);
    const [table, id, ...fields] = path.split(".");
    const tableRows = rows[table] ?? [];
    if (id === undefined) return { table, kind: "table", rows: tableRows };

    const row = tableRows.find((candidate) => candidate._id === id);
    if (row === undefined) return undefined;
    if (fields.length === 0) return { table, kind: "row", row };

    const value = fields.reduce<unknown>((step, field) => {
      return step !== null && typeof step === "object"
        ? (step as Record<string, unknown>)[field]
        : undefined;
    }, row);
    return value === undefined ? undefined : { table, kind: "field", fields, value };
  };

  return {
    calls,
    rows,
    store: {
      create: (table: string, fields: unknown) => {
        calls.push(`create ${table} ${JSON.stringify(fields)}`);
        return `${table}:new`;
      },
      read,
      update: (path: string, value: unknown) => calls.push(`update ${path} ${JSON.stringify(value)}`),
      remove: (path: string) => calls.push(`remove ${path}`)
    }
  };
});

vi.mock("$runtime/server/start.server", () => ({ serverModel: () => model }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () => Promise.resolve({ projectId: "p", userId: "u", username: "You" })
}));

const { create } = await import("$capabilities/store/api/create/create");
const { read } = await import("$capabilities/store/api/read/read");
const { update } = await import("$capabilities/store/api/update/update");
const { remove } = await import("$capabilities/store/api/remove/remove");

beforeEach(() => {
  model.calls.length = 0;
});

describe("input admission", () => {
  it("refuses an input that is not an object", async () => {
    for (const procedure of [create, read, update, remove]) {
      await expect(procedure("documents.x")).rejects.toThrow(/an input is an object/);
    }
  });

  it("refuses a path that is not a non-empty string", async () => {
    for (const procedure of [read, update, remove]) {
      await expect(procedure({ path: "", value: 1 })).rejects.toThrow(/non-empty string/);
      await expect(procedure({ path: 7, value: 1 })).rejects.toThrow(/non-empty string/);
    }
  });

  it("refuses malformed create input", async () => {
    await expect(create({ table: "projects", fields: [] })).rejects.toThrow(/fields is an object/);
    await expect(create({ table: "", fields: {} })).rejects.toThrow(/non-empty string/);
  });

  it("refuses an update with no value", async () => {
    await expect(update({ path: "projects.p.name" })).rejects.toThrow(/value is required/);
  });

  it("does not reach the store when it refuses", async () => {
    await expect(read({ path: "" })).rejects.toThrow();
    expect(model.calls).toEqual([]);
  });
});

describe("scope-projected reads", () => {
  it("drops malformed and ambiguous stored rows before filtering or projection", async () => {
    const original = model.rows.documents;
    model.rows.documents = [
      null,
      [],
      { _id: "documents:missing-time", projectId: "p", title: "No time" },
      {
        _id: "documents:duplicate",
        _creationTime: 1,
        projectId: "p",
        title: "First"
      },
      {
        _id: "documents:duplicate",
        _creationTime: 2,
        projectId: "p",
        title: "Second"
      },
      {
        _id: "documents:safe",
        _creationTime: 3,
        projectId: "p",
        title: "Safe"
      }
    ] as unknown as Record<string, unknown>[];

    try {
      expect(await read({ path: "documents" })).toEqual({
        table: "documents",
        kind: "table",
        rows: [
          {
            _id: "documents:safe",
            _creationTime: 3,
            projectId: "p",
            title: "Safe"
          }
        ]
      });
      expect(await read({ path: "documents.documents:duplicate" })).toBeNull();
      expect(await read({ path: "documents.documents:safe.title" })).toEqual({
        table: "documents",
        kind: "field",
        fields: ["title"],
        value: "Safe"
      });
    } finally {
      model.rows.documents = original;
    }
  });

  it("refuses actor and resource-link extras under allowed composite fields", async () => {
    const originalActivity = model.rows.activity;
    const originalComments = model.rows.comments;
    model.rows.activity = [
      {
        _id: "activity:safe",
        _creationTime: 1,
        projectId: "p",
        actor: { kind: "connector", connectorId: "connectors:1" },
        actorLabel: "Drive",
        verb: "synced",
        target: { kind: "connector", id: "connectors:1", label: "Drive" }
      },
      {
        _id: "activity:actor-extra",
        _creationTime: 2,
        projectId: "p",
        actor: { kind: "user", userId: "u", credential: "actor-secret" },
        actorLabel: "You",
        verb: "edited",
        target: { kind: "document", id: "documents:1", label: "Visible" }
      },
      {
        _id: "activity:target-extra",
        _creationTime: 3,
        projectId: "p",
        actor: { kind: "system" },
        actorLabel: "Icarus",
        verb: "edited",
        target: {
          kind: "document",
          id: "documents:1",
          label: "Visible",
          credential: "target-secret"
        }
      }
    ];
    model.rows.comments = [
      {
        _id: "comments:nested-extra",
        _creationTime: 4,
        projectId: "p",
        threadId: "commentThreads:1",
        blocks: [],
        mentions: [
          {
            kind: "actor",
            actor: { kind: "user", userId: "u", credential: "nested-secret" }
          }
        ],
        author: { kind: "user", userId: "u" }
      }
    ];

    try {
      const activity = await read({ path: "activity" });
      expect(activity?.kind === "table" ? activity.rows : []).toEqual([
        {
          _id: "activity:safe",
          _creationTime: 1,
          projectId: "p",
          actor: { kind: "connector", connectorId: "connectors:1" },
          actorLabel: "Drive",
          verb: "synced",
          target: { kind: "connector", id: "connectors:1", label: "Drive" }
        }
      ]);
      expect(await read({ path: "activity.activity:actor-extra.actor" })).toBeNull();
      expect(await read({ path: "comments" })).toEqual({
        table: "comments",
        kind: "table",
        rows: []
      });
      expect(JSON.stringify([activity, await read({ path: "comments" })])).not.toMatch(
        /actor-secret|target-secret|nested-secret/
      );
    } finally {
      model.rows.activity = originalActivity;
      model.rows.comments = originalComments;
    }
  });

  it("does not let a malformed membership authorize a user projection", async () => {
    const originalMemberships = model.rows.memberships;
    model.rows.memberships = [
      ...originalMemberships,
      {
        _id: "memberships:malformed",
        _creationTime: 1,
        projectId: "p",
        userId: "stranger",
        role: "invented"
      }
    ];

    try {
      const users = await read({ path: "users" });
      expect(JSON.stringify(users)).not.toContain("Stranger");
    } finally {
      model.rows.memberships = originalMemberships;
    }
  });

  it("filters project-owned table reads and projects only approved fields", async () => {
    expect(await read({ path: "documents" })).toEqual({
      table: "documents",
      kind: "table",
      rows: [
        { _id: "documents:1", _creationTime: 1, projectId: "p", title: "Visible" }
      ]
    });
    expect(await read({ path: "variables" })).toEqual({
      table: "variables",
      kind: "table",
      rows: [
        {
          _id: "variables:1",
          _creationTime: 1,
          projectId: "p",
          name: "Visible variable",
          value: { kind: "number", value: 4 }
        }
      ]
    });
  });

  it("allows approved fields on a scoped row and makes a foreign row look absent", async () => {
    expect(await read({ path: "documents.documents:1.title" })).toEqual({
      table: "documents",
      kind: "field",
      fields: ["title"],
      value: "Visible"
    });
    expect(await read({ path: "documents.documents:2.title" })).toBeNull();
  });

  it("projects complete row reads and refuses traversal below an approved field", async () => {
    expect(await read({ path: "documents.documents:1" })).toEqual({
      table: "documents",
      kind: "row",
      row: { _id: "documents:1", _creationTime: 1, projectId: "p", title: "Visible" }
    });
    await expect(read({ path: "variables.variables:1.value.kind" })).rejects.toThrow(
      /nested fields require/
    );
  });

  it("returns only the active project and its memberships without private fields", async () => {
    expect(await read({ path: "projects" })).toEqual({
      table: "projects",
      kind: "table",
      rows: [
        { _id: "p", _creationTime: 1, name: "Mine", description: "Visible" }
      ]
    });
    expect(await read({ path: "memberships" })).toEqual({
      table: "memberships",
      kind: "table",
      rows: [
        { _id: "memberships:1", _creationTime: 1, projectId: "p", userId: "u", role: "owner" },
        {
          _id: "memberships:2",
          _creationTime: 1,
          projectId: "p",
          userId: "friend",
          role: "editor"
        }
      ]
    });
  });

  it("joins through scoped memberships and returns only display names for users", async () => {
    expect(await read({ path: "users" })).toEqual({
      table: "users",
      kind: "table",
      rows: [
        { _id: "u", _creationTime: 1, displayName: "You" },
        { _id: "friend", _creationTime: 1, displayName: "Friend" }
      ]
    });
    expect(await read({ path: "users.stranger.displayName" })).toBeNull();
  });

  it("does not treat a project-less persona as globally readable", async () => {
    expect(await read({ path: "personas" })).toEqual({
      table: "personas",
      kind: "table",
      rows: [
        { _id: "personas:1", _creationTime: 1, projectId: "p", name: "Visible persona" }
      ]
    });
  });

  it("does not expose credentials, auth data, membership tokens, or template provenance", async () => {
    expect(await read({ path: "connectors" })).toEqual({
      table: "connectors",
      kind: "table",
      rows: [
        { _id: "connectors:1", _creationTime: 1, projectId: "p", name: "Drive" }
      ]
    });
    for (const path of [
      "connectors.connectors:1.credential",
      "users.u.email",
      "memberships.memberships:1.token",
      "documents.documents:1.templateId"
    ]) {
      await expect(read({ path })).rejects.toThrow(/requires its subject capability/);
    }
  });

  it("does not expose template or authored-body tables", async () => {
    for (const path of ["templates", "templateVersions", "documentSnapshots", "externalFiles"]) {
      await expect(read({ path })).rejects.toThrow(/requires its subject capability/);
    }
  });

  it("answers null rather than undefined when a scoped row is missing", async () => {
    expect(await read({ path: "documents.documents:99" })).toBeNull();
  });
});

describe("generic mutation compatibility", () => {
  it("keeps the existing create, update, and remove procedures intact", async () => {
    expect(await create({ table: "documents", fields: { projectId: "p", title: "Draft" } })).toEqual({
      id: "documents:new"
    });
    expect(await update({ path: "documents.documents:1.title", value: "Final" })).toEqual({
      path: "documents.documents:1.title"
    });
    expect(await remove({ path: "documents.documents:1.templateId" })).toEqual({
      path: "documents.documents:1.templateId"
    });
    expect(model.calls).toEqual([
      'create documents {"projectId":"p","title":"Draft"}',
      'update documents.documents:1.title "Final"',
      "remove documents.documents:1.templateId"
    ]);
  });
});
