import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";

import {
  cleanupExternalFiles,
  prepareExternalFiles,
  readExternalFile,
  readExternalFileContent,
  readExternalFileHistory,
  reuploadExternalFile,
  updateExternalFileContext,
  upload
} from "$capabilities/external-files/test/unit/external-files-fixture";

beforeEach(prepareExternalFiles);
afterEach(cleanupExternalFiles);

describe("External replacement and authored context", () => {
  it("re-uploads in place, retires the old blob, and records durable history", async () => {
    const created = await upload([
      new File(["export const version = 1;"], "module.ts", { type: "text/typescript" })
    ], ["src/module.ts"]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const before = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(before !== null && !("unavailable" in before));
    if (before === null || "unavailable" in before) return;

    const replaced = await reuploadExternalFile({
      id: "reupload",
      externalFileId: before.id,
      baseRevision: before.revision,
      file: new File(["export const version = 2;"], "replacement.ts", {
        type: "text/typescript"
      })
    });
    assert.equal(replaced.accepted, true);
    if (!replaced.accepted) return;
    assert.equal(replaced.externalFileId, before.id);
    assert.equal(replaced.revision, before.revision + 1);
    assert.equal(replaced.previousBlob, "removed");
    assert.equal(replaced.subkind, "code");
    const after = await readExternalFile({ externalFileId: before.id });
    assert.ok(after !== null && !("unavailable" in after));
    if (after === null || "unavailable" in after) return;
    assert.equal(after.name, "module.ts");
    assert.equal(after.relativePath, "src/module.ts");
    assert.notEqual(after.hash, before.hash);
    assert.equal(
      new TextDecoder().decode((await readExternalFileContent({ externalFileId: before.id }))?.bytes),
      "export const version = 2;"
    );
    assert.deepEqual(
      (await readExternalFileHistory()).entries.map((entry) => entry.event),
      ["re-uploaded", "uploaded"]
    );
  });

  it("stores optional dataset context as authored material input", async () => {
    const created = await upload([
      new File(["account,value\nA,10"], "ledger.csv", { type: "text/csv" })
    ]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const before = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(before !== null && !("unavailable" in before));
    if (before === null || "unavailable" in before) return;
    const changed = await updateExternalFileContext({
      externalFileId: before.id,
      baseRevision: before.revision,
      semanticContext: "Monthly invoiced value in US dollars; test accounts are excluded."
    });
    assert.equal(changed.accepted, true);
    const after = await readExternalFile({ externalFileId: before.id });
    assert.ok(after !== null && !("unavailable" in after));
    if (after === null || "unavailable" in after) return;
    assert.equal(after.semanticContext, "Monthly invoiced value in US dollars; test accounts are excluded.");
    assert.equal((await readExternalFileHistory()).entries[0].event, "context-updated");
  });

  it("refuses dataset context on a non-data file", async () => {
    const created = await upload([
      new File(["export const value = 1;"], "value.ts", { type: "text/typescript" })
    ]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;
    const result = await updateExternalFileContext({
      externalFileId: outcome.externalFileId,
      baseRevision: outcome.revision,
      semanticContext: "This must not become code metadata."
    });
    assert.equal(result.accepted, false);
    if (!result.accepted) assert.equal(result.reason, "wrong-kind");
  });

  it("removes dataset-only context when replacement changes the file kind", async () => {
    const created = await upload([
      new File(['{"value":1}'], "payload.bin", { type: "application/json" })
    ]);
    const outcome = created.outcomes[0];
    assert.notEqual(outcome.status, "rejected");
    if (outcome.status === "rejected") return;

    const contextualized = await updateExternalFileContext({
      externalFileId: outcome.externalFileId,
      baseRevision: outcome.revision,
      semanticContext: "A current structured payload."
    });
    assert.equal(contextualized.accepted, true);
    if (!contextualized.accepted) return;

    const replaced = await reuploadExternalFile({
      id: "reupload",
      externalFileId: outcome.externalFileId,
      baseRevision: contextualized.revision,
      file: new File(["plain prose"], "replacement.txt", { type: "text/plain" })
    });
    assert.equal(replaced.accepted, true);
    const after = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(after !== null && !("unavailable" in after));
    if (after === null || "unavailable" in after) return;
    assert.equal(after.subkind, "text");
    assert.equal(after.semanticContext, undefined);
  });
});
