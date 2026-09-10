import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({
    projectId: "projects:atomic",
    userId: "users:atomic",
    username: "Atomic User"
  })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { renameExternalFile } from "$capabilities/external-files/api/rename-external-file/rename-external-file";
import {
  cleanupAtomicFixtures,
  makeAtomicFixture,
  rowsIn
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";

afterEach(cleanupAtomicFixtures);

describe("concurrent External mutations", () => {
  it("allows exactly one compare-and-swap author to advance row, history, and outbox", async () => {
    const fixture = await makeAtomicFixture();
    runtime.model = fixture.model;
    const [left, right] = await Promise.all([
      renameExternalFile({
        externalFileId: fixture.ids[0],
        baseRevision: 1,
        name: "left.ts"
      }),
      renameExternalFile({
        externalFileId: fixture.ids[0],
        baseRevision: 1,
        name: "right.ts"
      })
    ]);

    expect([left, right].filter((result) => result.accepted)).toHaveLength(1);
    expect([left, right].filter(
      (result) => !result.accepted && result.reason === "stale"
    )).toHaveLength(1);
    expect(rowsIn(runtime.model.store, "externalFiles")[0]).toMatchObject({ revision: 2 });
    expect(rowsIn(runtime.model.store, "activity").filter(
      (row) => row.verb === "renamed"
    )).toHaveLength(1);
    expect(rowsIn(runtime.model.store, "semanticMaterialJobs")).toEqual([
      expect.objectContaining({ requestedRevision: 2, state: "queued" })
    ]);
  });
});
