import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

const model = vi.hoisted(() => ({
  projectId: "projects:mine",
  userId: "users:me",
  tables: new Map<string, unknown>()
}));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({
      projectId: model.projectId,
      userId: model.userId,
      username: "Me"
    })
}));

vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => {
    const store = {
      read: (table: string) => ({
        table,
        kind: "table",
        rows: model.tables.get(table) ?? []
      }),
      update: (path: string, value: unknown) => {
        const [table, id, field] = path.split(".");
        const rows = (model.tables.get(table) ?? []) as Record<string, unknown>[];
        const row = rows.find((candidate) => candidate._id === id);
        if (row === undefined || field === undefined) throw new Error(`No row at ${path}`);
        row[field] = value;
      },
      remove: (path: string) => {
        const [table, id, field] = path.split(".");
        const rows = (model.tables.get(table) ?? []) as Record<string, unknown>[];
        const row = rows.find((candidate) => candidate._id === id);
        if (row === undefined || field === undefined) throw new Error(`No row at ${path}`);
        delete row[field];
      },
      transaction: <T>(work: (unit: StoreUnitOfWork) => T): T =>
        work(store as unknown as StoreUnitOfWork)
    };
    return { store };
  }
}));

const { readProjectOverview } = await import(
  "$capabilities/project/api/read-project-overview/read-project-overview"
);
const { readProjectHistory } = await import(
  "$capabilities/project/api/read-project-history/read-project-history"
);
const { readProjectPerson } = await import(
  "$capabilities/project/api/read-project-person/read-project-person"
);
const { readProjectActivity } = await import(
  "$capabilities/project/api/read-project-activity/read-project-activity"
);
const { readProjectComment } = await import(
  "$capabilities/project/api/read-project-comment/read-project-comment"
);
const { readProjectResource } = await import(
  "$capabilities/project/api/read-project-resource/read-project-resource"
);
const { updateProjectResourceSummary } = await import(
  "$capabilities/project/api/update-project-resource-summary/update-project-resource-summary"
);

const user = (id: string) => ({ kind: "user", userId: id });

beforeEach(() => {
  model.tables.clear();
  model.tables.set("projects", [
    {
      _id: "projects:mine",
      _creationTime: 10,
      name: "Mine",
      updatedAt: 20
    },
    {
      _id: "projects:other",
      _creationTime: 11,
      name: "Other",
      archivedAt: 12
    }
  ]);
  model.tables.set("memberships", [
    {
      _id: "memberships:me",
      _creationTime: 12,
      projectId: "projects:mine",
      userId: "users:me",
      role: "owner"
    },
    {
      _id: "memberships:other",
      _creationTime: 13,
      projectId: "projects:other",
      userId: "users:other",
      role: "owner"
    }
  ]);
  model.tables.set("users", [
    {
      _id: "users:me",
      _creationTime: 1,
      displayName: "Me",
      email: "me@example.org",
      authSubject: "must-not-cross",
      settings: "must-not-cross"
    },
    {
      _id: "users:other",
      _creationTime: 1,
      displayName: "Other",
      email: "other@example.org"
    }
  ]);
});

describe("project panel reads", () => {
  it("keeps the overview to administrative context not already on the canvas", async () => {
    await expect(readProjectOverview()).resolves.toEqual({
      projectId: "projects:mine",
      status: "active",
      viewerRole: "owner",
      createdAt: 10
    });
  });

  it("searches only scoped activity and never joins directed comments", async () => {
    model.tables.set("activity", [
      {
        _id: "activity:2",
        _creationTime: 30,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me then",
        verb: "edited",
        target: { kind: "document", id: "documents:1", label: "Brief" }
      },
      {
        _id: "activity:1",
        _creationTime: 20,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me then",
        verb: "opened",
        target: { kind: "document", id: "documents:1", label: "Brief" }
      },
      {
        _id: "activity:foreign",
        _creationTime: 40,
        projectId: "projects:other",
        actor: user("users:other"),
        actorLabel: "Other secret",
        verb: "edited",
        target: { kind: "document", id: "documents:other", label: "Foreign" }
      }
    ]);
    model.tables.set("comments", [
      {
        _id: "comments:directed",
        projectId: "projects:mine",
        blocks: [{ display: "Directed secret" }],
        mentions: [user("users:me")]
      }
    ]);

    const result = await readProjectHistory({
      search: "brief",
      since: null,
      before: null,
      limit: 1
    });

    expect(result).toMatchObject({ matched: 2, total: 2, hasMore: true });
    expect(result.entries.map((entry) => entry.id)).toEqual(["activity:2"]);
    expect(JSON.stringify(result)).not.toMatch(/Directed secret|Other secret|Foreign/);
    await expect(
      readProjectHistory({ search: "", since: null, before: null, limit: 10, userId: "forged" })
    ).rejects.toThrow(/only search, since, before, and limit/);
  });

  it("returns one visible member with policy-safe profile and contribution fields", async () => {
    model.tables.set("activity", [
      {
        _id: "activity:mine",
        _creationTime: 30,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me",
        verb: "edited",
        target: { kind: "document", id: "documents:1", label: "Brief" }
      }
    ]);
    model.tables.set("comments", [
      {
        _id: "comments:mine",
        projectId: "projects:mine",
        author: user("users:me")
      }
    ]);
    model.tables.set("documents", [
      {
        _id: "documents:1",
        projectId: "projects:mine",
        title: "Brief",
        createdBy: user("users:me")
      }
    ]);

    const result = await readProjectPerson({ userId: "users:me" });
    expect(result).toMatchObject({
      id: "users:me",
      name: "Me",
      email: "me@example.org",
      role: "owner",
      joinedAt: 12,
      contribution: { events: 1, comments: 1, resources: 1 }
    });
    expect(result?.recentActivity).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/must-not-cross/);
    await expect(readProjectPerson({ userId: "users:other" })).resolves.toBeNull();
  });

  it("returns only the selected recorded event", async () => {
    model.tables.set("activity", [
      {
        _id: "activity:selected",
        _creationTime: 30,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me then",
        verb: "edited",
        target: { kind: "document", id: "documents:1", label: "Brief then" },
        context: { kind: "section", id: "section:1", label: "Exposure" },
        detail: "Updated the assumptions."
      },
      {
        _id: "activity:nearby",
        _creationTime: 20,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me then",
        verb: "opened",
        target: { kind: "document", id: "documents:1", label: "Brief then" }
      },
      {
        _id: "activity:elsewhere",
        _creationTime: 10,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me then",
        verb: "opened",
        target: { kind: "document", id: "documents:2", label: "Other" }
      }
    ]);

    const result = await readProjectActivity({ activityId: "activity:selected" });
    expect(result).toMatchObject({
      id: "activity:selected",
      detail: "Updated the assumptions.",
      context: { label: "Exposure" }
    });
    expect(JSON.stringify(result)).not.toMatch(/activity:nearby|activity:elsewhere/);
  });

  it("projects a resource summary and consumer-facing facts without returning its body", async () => {
    model.tables.set("documents", [
      {
        _id: "documents:1",
        _creationTime: 10,
        projectId: "projects:mine",
        title: "Brief",
        summary: "A short decision brief.",
        templateId: "templates:1",
        createdBy: user("users:me"),
        updatedBy: user("users:me"),
        updatedAt: 30
      }
    ]);
    model.tables.set("templates", [{ _id: "templates:1", name: "Decision brief" }]);
    model.tables.set("documentSnapshots", [
      {
        _id: "documentSnapshots:1",
        projectId: "projects:mine",
        resourceId: "documents:1",
        revision: 3,
        role: "leader",
        body: {
          secret: "authored body",
          rows: [
            {
              kind: "blocks",
              blocks: [{ type: "text", display: "Three useful words" }]
            }
          ]
        }
      }
    ]);
    model.tables.set("commentThreads", [
      {
        _id: "commentThreads:1",
        projectId: "projects:mine",
        target: { kind: "document", id: "documents:1" }
      },
      {
        _id: "commentThreads:research",
        projectId: "projects:mine",
        target: { kind: "research", id: "researchThreads:1" }
      }
    ]);
    model.tables.set("researchThreads", [
      {
        _id: "researchThreads:1",
        _creationTime: 11,
        projectId: "projects:mine",
        title: "What drives customer-minutes lost?",
        summary: "A focused research chat.",
        findingIds: ["findings:1", "findings:2"],
        createdBy: user("users:me")
      }
    ]);
    model.tables.set("findings", [
      {
        _id: "findings:1",
        projectId: "projects:mine",
        sources: [
          { kind: "resource", ref: { kind: "document", id: "documents:1" } }
        ]
      }
    ]);
    model.tables.set("activity", [
      {
        _id: "activity:1",
        _creationTime: 30,
        projectId: "projects:mine",
        actor: user("users:me"),
        actorLabel: "Me",
        verb: "edited",
        target: { kind: "document", id: "documents:1", label: "Brief" }
      }
    ]);

    const result = await readProjectResource({ resourceId: "documents:1" });
    expect(result).toMatchObject({
      id: "documents:1",
      kind: "document",
      name: "Brief",
      summary: "A short decision brief.",
      facts: [
        { label: "Words", value: "3" },
        { label: "Comments", value: "1" }
      ],
      openable: true
    });
    expect(result?.recentActivity).toHaveLength(1);
    expect(JSON.stringify(result)).not.toMatch(/authored body/);

    await expect(readProjectResource({ resourceId: "researchThreads:1" })).resolves.toMatchObject({
      kind: "research",
      facts: [
        { label: "Findings", value: "2" },
        { label: "Comments", value: "1" }
      ],
      openable: false
    });
  });

  it("projects a scoped comment thread with its resource and reply chronology", async () => {
    model.tables.set("documents", [
      {
        _id: "documents:1",
        _creationTime: 10,
        projectId: "projects:mine",
        title: "Brief",
        createdBy: user("users:me"),
        updatedBy: user("users:me"),
        updatedAt: 30
      }
    ]);
    model.tables.set("commentThreads", [
      {
        _id: "commentThreads:1",
        _creationTime: 20,
        projectId: "projects:mine",
        target: { kind: "document", id: "documents:1" },
        quote: "Selected words",
        within: {
          kind: "text",
          spans: [
            {
              blockId: "block:1",
              from: { atom: "atom:1", offset: 0 },
              to: { atom: "atom:1", offset: 14 }
            }
          ]
        },
        createdBy: user("users:me"),
        updatedAt: 30
      },
      {
        _id: "commentThreads:foreign",
        _creationTime: 20,
        projectId: "projects:other",
        target: { kind: "document", id: "documents:1" },
        createdBy: user("users:other"),
        updatedAt: 30
      }
    ]);
    model.tables.set("comments", [
      {
        _id: "comments:reply",
        _creationTime: 30,
        projectId: "projects:mine",
        threadId: "commentThreads:1",
        blocks: [{ display: "The reply" }],
        author: user("users:me")
      },
      {
        _id: "comments:opening",
        _creationTime: 20,
        projectId: "projects:mine",
        threadId: "commentThreads:1",
        blocks: [{ display: "The opening" }],
        author: user("users:me")
      }
    ]);

    const result = await readProjectComment({ threadId: "commentThreads:1" });
    expect(result).toMatchObject({
      id: "commentThreads:1",
      state: "open",
      target: { id: "documents:1", kind: "document", name: "Brief" },
      anchor: { kind: "document-text", blockId: "block:1" },
      selectedText: "Selected words",
      opening: { id: "comments:opening", text: "The opening" }
    });
    expect(result?.replies.map((reply) => reply.id)).toEqual(["comments:reply"]);
    await expect(readProjectComment({ threadId: "commentThreads:foreign" })).resolves.toBeNull();
  });

  it("updates only a visible resource summary and stamps the scoped viewer", async () => {
    const mine = {
      _id: "documents:1",
      _creationTime: 10,
      projectId: "projects:mine",
      title: "Brief",
      createdBy: user("users:me"),
      updatedBy: user("users:me"),
      updatedAt: 20
    };
    const foreign = {
      _id: "documents:foreign",
      _creationTime: 10,
      projectId: "projects:other",
      title: "Foreign",
      createdBy: user("users:other"),
      updatedBy: user("users:other"),
      updatedAt: 20
    };
    model.tables.set("documents", [mine, foreign]);

    const result = await updateProjectResourceSummary({
      resourceId: "documents:1",
      summary: "  Executive context.  "
    });
    expect(result).toMatchObject({ resourceId: "documents:1", summary: "Executive context." });
    expect(mine).toMatchObject({
      summary: "Executive context.",
      updatedBy: user("users:me")
    });
    await expect(
      updateProjectResourceSummary({ resourceId: "documents:foreign", summary: "No" })
    ).rejects.toThrow(/no resource/);
    expect(foreign).not.toHaveProperty("summary");
  });
});
