import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";

import { asId } from "$representation/data/behavior/core/id";
import {
  cleanupExternalFiles,
  externalFilesState,
  prepareExternalFiles,
  readExternalFile,
  readExternalFileLibrary,
  upload
} from "$capabilities/external-files/test/unit/external-files-fixture";

beforeEach(prepareExternalFiles);
afterEach(cleanupExternalFiles);

describe("External display relations", () => {
  it("keeps a file visible when its related user, task, and connector are gone", async () => {
    const created = await upload([
      new File(["Current content"], "record.txt", { type: "text/plain" })
    ]);
    const outcome = created.outcomes[0];
    assert.equal(outcome.status, "uploaded");
    if (outcome.status !== "uploaded") return;

    const store = externalFilesState().model.store;
    const path = `externalFiles.${outcome.externalFileId}`;
    store.update(`${path}.createdBy`, {
      kind: "user",
      userId: asId<"users">("users:removed")
    });
    store.update(`${path}.updatedBy`, {
      kind: "agent",
      taskId: asId<"agentTasks">("agentTasks:removed")
    });
    store.update(`${path}.origin`, {
      kind: "connector",
      connectorId: asId<"connectors">("connectors:removed"),
      sourceId: "source:removed"
    });

    const library = await readExternalFileLibrary();
    assert.equal(library.files.length, 1);
    assert.equal("unavailable" in library, false);
    const file = library.files[0];
    assert.equal(file.id, outcome.externalFileId);
    assert.equal(file.createdByName, "User no longer available");
    assert.equal(file.updatedByName, "Task no longer available");
    assert.deepEqual(file.origin, {
      kind: "connector",
      label: "Connector",
      connectorId: "connectors:removed",
      sourceId: "source:removed"
    });

    const detail = await readExternalFile({ externalFileId: outcome.externalFileId });
    assert.ok(detail !== null);
    assert.equal(detail.createdByName, "User no longer available");
    assert.equal(detail.updatedByName, "Task no longer available");
  });
});
