import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { renameExternalFile } from "$capabilities/external-files/api/rename-external-file/rename-external-file";
import {
  cleanupAtomicFixtures,
  EXISTING_EXTERNAL_MUTATION_TABLES,
  makeAtomicFixture,
  rowsIn
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";
import {
  expectRevisionBundle,
  verifyMutationAtomicity
} from "$capabilities/external-files/test/non-functional/atomicity-verification";

afterEach(cleanupAtomicFixtures);

describe("rename External file failpoint atomicity", () => {
  it("rolls back before journal commit and recovers revision, history, and outbox together", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(),
      setModel: (model) => { runtime.model = model; },
      changedTables: EXISTING_EXTERNAL_MUTATION_TABLES,
      run: (fixture) => renameExternalFile({
        externalFileId: fixture.ids[0], baseRevision: 1, name: "renamed.ts"
      }),
      verifyBefore: (model, fixture) => {
        expect(rowsIn(model.store, "externalFiles")[0]).toMatchObject({
          _id: fixture.ids[0], name: "file-1.ts", revision: 1
        });
        expect(rowsIn(model.store, "activity")).toHaveLength(0);
      },
      verifyAfter: (model, fixture) => {
        expectRevisionBundle(model, fixture.ids[0]!, 2, "external-file.renamed");
        expect(rowsIn(model.store, "externalFiles")[0]).toMatchObject({
          name: "renamed.ts", relativePath: "renamed.ts"
        });
      }
    });
  });
});
