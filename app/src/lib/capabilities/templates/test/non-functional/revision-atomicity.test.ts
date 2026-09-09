import { describe, expect, it } from "vitest";

import { defineStore } from "$model/server/store/index.server";

describe("template revision atomicity", () => {
  it("keeps a leader snapshot, change set, and template revision in one failpoint boundary", () => {
    const store = defineStore({ now: () => 1000 });
    const projectId = store.create("projects", { name: "Project" });
    const documentId = store.create("documents", { projectId, title: "Stage" });
    const snapshotId = store.create("documentSnapshots", {
      projectId,
      resourceId: documentId,
      role: "leader",
      revision: 1,
      part: 0,
      body: { rows: [] },
      at: 1000
    });
    const changeSetId = store.create("documentChangeSets", {
      projectId,
      resourceId: documentId,
      revision: 1,
      operations: []
    });

    store.transaction((unit) => {
      unit.update(`documentSnapshots.${snapshotId}.revision`, 2);
      unit.update(`documentChangeSets.${changeSetId}.revision`, 2);
    });

    expect(store.read(`documentSnapshots.${snapshotId}.revision`)).toMatchObject({ value: 2 });
    expect(store.read(`documentChangeSets.${changeSetId}.revision`)).toMatchObject({ value: 2 });
  });
});
