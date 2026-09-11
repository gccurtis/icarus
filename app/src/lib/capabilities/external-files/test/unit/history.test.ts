import { describe, expect, it } from "vitest";

import { recordExternalFileActivity } from "$capabilities/activity";
import { externalFileHistoryIn } from "$capabilities/external-files/api/shared/history";
import { asId } from "$representation/data/behavior/core/id";
import { defineStore } from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";

const scope: Scope = {
  projectId: "projects:history",
  userId: "users:author",
  username: "Author"
};

const limits: Record<string, number> = {
  "externalFiles.upload.maxFiles": 10,
  "externalFiles.upload.maxFileBytes": 1_000_000,
  "externalFiles.upload.maxBatchBytes": 2_000_000,
  "externalFiles.upload.maxPathBytes": 512,
  "externalFiles.download.maxResponseBytes": 1_000_000
};

const modelWith = (store: ReturnType<typeof defineStore>): ServerModel => ({
  store,
  configuration: { get: (key: string) => limits[key] }
} as unknown as ServerModel);

const addFile = (store: ReturnType<typeof defineStore>) => store.create("externalFiles", {
  projectId: asId<"projects">(scope.projectId),
  name: "readme.md",
  originalName: "readme.md",
  relativePath: "folder/readme.md",
  mediaType: "text/markdown",
  subkind: "text",
  storageId: `_storage:${"a".repeat(64)}`,
  hash: "a".repeat(64),
  size: 4,
  origin: { kind: "upload" },
  createdBy: { kind: "user", userId: asId<"users">(scope.userId) },
  updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
  revision: 1,
  updatedAt: 10
});

describe("External file history current shape", () => {
  it("stores typed facts and derives one shared presentation", () => {
    const store = defineStore({ now: () => 10 });
    const id = addFile(store);
    store.transaction((unit) => recordExternalFileActivity(unit, scope, {
      kind: "external-file.uploaded",
      file: { id, name: "readme.md", relativePath: "folder/readme.md" },
      size: 4,
      mediaType: "text/markdown"
    }));

    const held = store.read("activity");
    expect(held?.kind).toBe("table");
    if (held?.kind !== "table" || held.table !== "activity") return;
    expect(held.rows[0].event).toEqual({
      kind: "external-file.uploaded",
      file: { id, name: "readme.md", relativePath: "folder/readme.md" },
      size: 4,
      mediaType: "text/markdown"
    });
    expect(externalFileHistoryIn(modelWith(store), scope)).toMatchObject([{
      type: "external-file.uploaded",
      what: "Uploaded 4 B MARKDOWN",
      externalFileId: id,
      name: "readme.md",
      relativePath: "folder/readme.md",
      actorName: "Author"
    }]);
  });

  it("rejects the former free-form Activity row", () => {
    const store = defineStore({ now: () => 10 });
    expect(() => store.create("activity", {
      projectId: asId<"projects">(scope.projectId),
      actor: { kind: "user", userId: asId<"users">(scope.userId) },
      actorLabel: scope.username,
      verb: "uploaded",
      target: { kind: "external-file", id: "externalFiles:old", label: "readme.md" }
    })).toThrow();
  });
});
