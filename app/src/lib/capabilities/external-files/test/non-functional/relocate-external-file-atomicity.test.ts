import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { relocateExternalFile } from "$capabilities/external-files/api/relocate-external-file/relocate-external-file";
import {
  cleanupAtomicFixtures,
  EXISTING_EXTERNAL_MUTATION_TABLES,
  expectRevisionBundle,
  makeAtomicFixture,
  rowsIn,
  verifyMutationAtomicity
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";

afterEach(cleanupAtomicFixtures);

describe("relocate External file failpoint atomicity", () => {
  it("recovers path, revision, history, and outbox as one committed intent", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(),
      setModel: (model) => { runtime.model = model; },
      changedTables: EXISTING_EXTERNAL_MUTATION_TABLES,
      run: (fixture) => relocateExternalFile({
        externalFileId: fixture.ids[0], baseRevision: 1, destinationDirectory: "archive"
      }),
      verifyBefore: (model) => {
        expect(rowsIn(model.store, "externalFiles")[0]).toMatchObject({
          relativePath: "file-1.ts", revision: 1
        });
      },
      verifyAfter: (model, fixture) => {
        expectRevisionBundle(model, fixture.ids[0]!, 2, "moved");
        expect(rowsIn(model.store, "externalFiles")[0]).toMatchObject({
          relativePath: "archive/file-1.ts"
        });
      }
    });
  });
});
