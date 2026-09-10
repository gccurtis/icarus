import { describe, expect, it } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import { defineStore } from "$model/server/store/index.server";
import type { Scope, ServerModel } from "$runtime/server/start.server";
import {
  externalFileHistoryIn,
  externalPathActivityId,
  recordExternalFileHistory
} from "$capabilities/external-files/api/shared/history";

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

describe("External file history current shape", () => {
  it("stores a stable identifier while preserving the exact path in the label", () => {
    const store = defineStore({ now: () => 10 });
    recordExternalFileHistory(store, scope, {
      event: "uploaded",
      externalFileId: asId<"externalFiles">("externalFiles:one"),
      name: "readme",
      relativePath: "folder/readme",
      detail: "4 bytes"
    });

    const held = store.read("activity");
    expect(held?.kind).toBe("table");
    if (held?.kind !== "table" || held.table !== "activity") return;
    expect(held.rows[0].context).toEqual({
      kind: "external-path",
      id: externalPathActivityId("folder/readme"),
      label: "folder/readme"
    });
    expect(externalFileHistoryIn(modelWith(store), scope)).toMatchObject([{
      externalFileId: "externalFiles:one",
      name: "readme",
      relativePath: "folder/readme",
      actorName: "Author"
    }]);
  });

  it("does not read the former path-as-id activity shape", () => {
    const store = defineStore({ now: () => 10 });
    store.create("activity", {
      projectId: asId<"projects">(scope.projectId),
      actor: { kind: "user", userId: asId<"users">(scope.userId) },
      actorLabel: scope.username,
      verb: "uploaded",
      target: { kind: "external-file", id: "externalFiles:old", label: "readme" },
      context: { kind: "external-path", id: "folder/readme", label: "folder/readme" }
    });

    expect(externalFileHistoryIn(modelWith(store), scope)).toEqual([]);
  });
});
