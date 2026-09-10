import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { relocateExternalDirectory } from "$capabilities/external-files/api/relocate-external-directory/relocate-external-directory";
import { externalDirectoryRevisionToken } from "$capabilities/external-files/api/shared/directories";
import {
  cleanupAtomicFixtures,
  EXISTING_EXTERNAL_MUTATION_TABLES,
  makeAtomicFixture,
  rowsIn,
  verifyMutationAtomicity
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";

afterEach(cleanupAtomicFixtures);

const tokenFor = (fixture: Awaited<ReturnType<typeof makeAtomicFixture>>): string =>
  externalDirectoryRevisionToken(rowsIn(fixture.model.store, "externalFiles").map((row) => ({
    item: {
      id: row._id as string,
      revision: row.revision as number,
      relativePath: row.relativePath as string
    }
  })));

describe("relocate External directory failpoint atomicity", () => {
  it("moves every descendant with no observable partial directory state", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(2),
      setModel: (model) => { runtime.model = model; },
      changedTables: EXISTING_EXTERNAL_MUTATION_TABLES,
      run: (fixture) => relocateExternalDirectory({
        sourceDirectory: "source",
        destinationDirectory: "archive",
        baseRevisionToken: tokenFor(fixture)
      }),
      verifyBefore: (model) => {
        expect(rowsIn(model.store, "externalFiles").map((row) => row.relativePath).sort()).toEqual([
          "source/group-1/file-1.ts",
          "source/group-2/file-2.ts"
        ]);
        expect(rowsIn(model.store, "activity")).toHaveLength(0);
      },
      verifyAfter: (model) => {
        const rows = rowsIn(model.store, "externalFiles");
        expect(rows.map((row) => row.relativePath).sort()).toEqual([
          "archive/group-1/file-1.ts",
          "archive/group-2/file-2.ts"
        ]);
        expect(rows.map((row) => row.revision)).toEqual([2, 2]);
        expect(rowsIn(model.store, "activity").filter((row) => row.verb === "moved")).toHaveLength(2);
        expect(rowsIn(model.store, "semanticMaterialJobs").map((row) => row.requestedRevision))
          .toEqual([2, 2]);
      }
    });
  });
});
