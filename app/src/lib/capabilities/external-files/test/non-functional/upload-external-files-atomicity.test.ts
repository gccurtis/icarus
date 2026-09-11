import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ServerModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
const runtime = vi.hoisted(() => ({ model: undefined as unknown as ServerModel }));
vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => ({ projectId: "projects:atomic", userId: "users:atomic", username: "Atomic User" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => runtime.model }));

import { uploadExternalFiles } from "$capabilities/external-files/api/upload-external-files/upload-external-files";
import {
  cleanupAtomicFixtures,
  makeAtomicFixture,
  rowsIn
} from "$capabilities/external-files/test/non-functional/atomicity-fixture";
import { verifyMutationAtomicity } from "$capabilities/external-files/test/non-functional/atomicity-verification";

afterEach(cleanupAtomicFixtures);

const source = "export const uploaded = true;\n";
const sourceBytes = new TextEncoder().encode(source);
const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");

describe("upload External files failpoint atomicity", () => {
  it("rolls back publication before commit and recovers row, history, and outbox after commit", async () => {
    await verifyMutationAtomicity({
      create: () => makeAtomicFixture(0),
      setModel: (model) => { runtime.model = model; },
      changedTables: ["activity", "externalFiles", "semanticMaterialJobs"],
      run: () => uploadExternalFiles({
        id: "files",
        files: [new File([source], "uploaded.ts", { type: "text/typescript" })]
      }),
      verifyBefore: async (model) => {
        expect(rowsIn(model.store, "externalFiles")).toHaveLength(0);
        expect(rowsIn(model.store, "activity")).toHaveLength(0);
        expect(rowsIn(model.store, "semanticMaterialJobs")).toHaveLength(0);
        expect(await model.externalFileStorage.read({
          storageId: asId<"_storage">(`_storage:${sourceHash}`),
          hash: sourceHash,
          size: sourceBytes.byteLength
        })).toBeUndefined();
      },
      verifyAfter: async (model) => {
        const rows = rowsIn(model.store, "externalFiles");
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
          name: "uploaded.ts", hash: sourceHash, revision: 1
        });
        expect(rowsIn(model.store, "activity")).toContainEqual(expect.objectContaining({
          event: expect.objectContaining({
            kind: "external-file.uploaded",
            file: expect.objectContaining({ id: rows[0]._id })
          })
        }));
        expect(rowsIn(model.store, "semanticMaterialJobs")).toContainEqual(expect.objectContaining({
          requestedRevision: 1,
          ref: expect.objectContaining({ id: rows[0]._id })
        }));
        expect(await model.externalFileStorage.read({
          storageId: asId<"_storage">(`_storage:${sourceHash}`),
          hash: sourceHash,
          size: sourceBytes.byteLength
        })).toEqual(sourceBytes);
      }
    });
  });
});
