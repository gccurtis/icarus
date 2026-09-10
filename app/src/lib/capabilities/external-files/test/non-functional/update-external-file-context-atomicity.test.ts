import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { updateExternalFileContext } from "$capabilities/external-files/api/update-external-file-context/update-external-file-context";
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

describe("update External context failpoint atomicity", () => {
  it("recovers context, revision, history, and outbox as one committed intent", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(1, "data"),
      setModel: (model) => { runtime.model = model; },
      changedTables: EXISTING_EXTERNAL_MUTATION_TABLES,
      run: (fixture) => updateExternalFileContext({
        externalFileId: fixture.ids[0],
        baseRevision: 1,
        semanticContext: "Monthly revenue in USD"
      }),
      verifyBefore: (model) => {
        expect(rowsIn(model.store, "externalFiles")[0]).not.toHaveProperty("semanticContext");
      },
      verifyAfter: (model, fixture) => {
        expectRevisionBundle(model, fixture.ids[0]!, 2, "context-updated");
        expect(rowsIn(model.store, "externalFiles")[0]).toMatchObject({
          semanticContext: "Monthly revenue in USD"
        });
      }
    });
  });
});
