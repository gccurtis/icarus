import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { removeExternalFile } from "$capabilities/external-files/api/remove-external-file/remove-external-file";
import {
  cleanupAtomicFixtures,
  EXISTING_EXTERNAL_MUTATION_TABLES,
  makeAtomicFixture,
  rowsIn
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";
import { verifyMutationAtomicity } from "$capabilities/external-files/test/non-functional/atomicity-verification";

afterEach(cleanupAtomicFixtures);

describe("remove External file failpoint atomicity", () => {
  it("recovers deletion, lifecycle history, and semantic forget together", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(),
      setModel: (model) => { runtime.model = model; },
      changedTables: EXISTING_EXTERNAL_MUTATION_TABLES,
      run: (fixture) => removeExternalFile({ externalFileId: fixture.ids[0], baseRevision: 1 }),
      verifyBefore: (model, fixture) => {
        expect(rowsIn(model.store, "externalFiles")).toContainEqual(expect.objectContaining({
          _id: fixture.ids[0], revision: 1
        }));
        expect(rowsIn(model.store, "semanticMaterialJobs")).toHaveLength(1);
        expect(rowsIn(model.store, "activity")).toHaveLength(0);
      },
      verifyAfter: async (model, fixture) => {
        expect(rowsIn(model.store, "externalFiles")).toHaveLength(0);
        expect(rowsIn(model.store, "semanticMaterialJobs")).toEqual([
          expect.objectContaining({
            requestedRevision: 2,
            state: "queued",
            ref: expect.objectContaining({ id: fixture.ids[0] })
          })
        ]);
        expect(rowsIn(model.store, "activity")).toContainEqual(expect.objectContaining({
          verb: "deleted",
          target: expect.objectContaining({ id: fixture.ids[0] })
        }));
        expect(await model.externalFileStorage.read({
          storageId: asId<"_storage">(`_storage:${fixture.hashes[0]}`),
          hash: fixture.hashes[0]!,
          size: new TextEncoder().encode("export const value1 = 1;\n").byteLength
        })).toBeUndefined();
      }
    });
  });
});
