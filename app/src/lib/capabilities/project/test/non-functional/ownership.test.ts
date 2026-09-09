import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string };

const scope = vi.hoisted(() => ({ projectId: "projects:mine" }));
const model = vi.hoisted(() => ({ documents: [] as Row[] }));

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: () =>
    Promise.resolve({ projectId: scope.projectId, userId: "users:me", username: "Me" })
}));

vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => {
    const store = {
      read: (table: string) => ({
        table,
        kind: "table",
        rows: table === "documents" ? model.documents : []
      }),
      update: (path: string, value: unknown) => {
        const [, id, field] = path.split(".");
        const row = model.documents.find((candidate) => candidate._id === id);
        if (row === undefined || field === undefined) throw new Error(`No row at ${path}`);
        row[field] = value;
      },
      remove: (path: string) => {
        const [, id, field] = path.split(".");
        const row = model.documents.find((candidate) => candidate._id === id);
        if (row === undefined || field === undefined) throw new Error(`No row at ${path}`);
        delete row[field];
      },
      transaction: <T>(work: (unit: StoreUnitOfWork) => T): T =>
        work(store as unknown as StoreUnitOfWork)
    };
    return { store };
  }
}));

const { updateProjectResourceSummary } = await import(
  "$capabilities/project/api/update-project-resource-summary/update-project-resource-summary"
);

const document = (id: string, projectId: string, summary: string): Row => ({
  _id: id,
  _creationTime: 1,
  projectId,
  title: id,
  summary,
  createdBy: { kind: "user", userId: "users:owner" },
  updatedBy: { kind: "user", userId: "users:owner" },
  updatedAt: 1
});

beforeEach(() => {
  scope.projectId = "projects:mine";
  model.documents = [
    document("documents:mine", "projects:mine", "Mine"),
    document("documents:theirs", "projects:theirs", "Theirs")
  ];
});

describe("project resource summary cross-project ownership", () => {
  it("updateProjectResourceSummary changes only a resource owned by the asking project", async () => {
    await updateProjectResourceSummary({
      resourceId: "documents:mine",
      summary: "Current summary"
    });

    expect(model.documents[0]).toMatchObject({
      summary: "Current summary",
      updatedBy: { kind: "user", userId: "users:me" }
    });
    expect(model.documents[1].summary).toBe("Theirs");
  });

  it("updateProjectResourceSummary refuses a resource owned by another project", async () => {
    await expect(
      updateProjectResourceSummary({
        resourceId: "documents:theirs",
        summary: "Crossed the boundary"
      })
    ).rejects.toThrow(/no resource/);

    expect(model.documents[1]).toMatchObject({
      summary: "Theirs",
      updatedBy: { kind: "user", userId: "users:owner" },
      updatedAt: 1
    });
  });
});
