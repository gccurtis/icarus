import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { reuploadExternalFile } from "$capabilities/external-files/api/reupload-external-file/reupload-external-file";
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

const replacement = "export const replacement = true;\n";
const replacementHash = createHash("sha256").update(replacement).digest("hex");

describe("re-upload External file failpoint atomicity", () => {
  it("recovers byte identity, revision, history, and outbox together", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(),
      setModel: (model) => { runtime.model = model; },
      changedTables: EXISTING_EXTERNAL_MUTATION_TABLES,
      run: (fixture) => reuploadExternalFile({
        id: "reupload",
        externalFileId: fixture.ids[0],
        baseRevision: 1,
        file: new File([replacement], "replacement.ts", { type: "text/typescript" })
      }),
      verifyBefore: async (model, fixture) => {
        expect(rowsIn(model.store, "externalFiles")[0]).toMatchObject({
          hash: fixture.hashes[0], revision: 1
        });
        expect(await model.externalFileStorage.read({
          storageId: asId<"_storage">(`_storage:${replacementHash}`),
          hash: replacementHash,
          size: new TextEncoder().encode(replacement).byteLength
        })).toBeUndefined();
      },
      verifyAfter: async (model, fixture) => {
        expectRevisionBundle(model, fixture.ids[0]!, 2, "re-uploaded");
        const row = rowsIn(model.store, "externalFiles")[0];
        expect(row).toMatchObject({ hash: replacementHash, storageId: `_storage:${replacementHash}` });
        expect(await model.externalFileStorage.read({
          storageId: asId<"_storage">(`_storage:${replacementHash}`),
          hash: replacementHash,
          size: new TextEncoder().encode(replacement).byteLength
        })).toEqual(new TextEncoder().encode(replacement));
        expect(await model.externalFileStorage.read({
          storageId: asId<"_storage">(`_storage:${fixture.hashes[0]}`),
          hash: fixture.hashes[0]!,
          size: 24
        })).toBeUndefined();
      }
    });
  });
});
