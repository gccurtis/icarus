import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Knowledge } from "../../src/0-platform/knowledge/knowledge.js";
import { JobRegistry } from "../../src/0-utils/jobs/registry.js";
import { createGeneralFileService } from "../../src/3-capabilities/general-files/application/generalFileService.js";
import { SQLiteGeneralFileStore } from "../../src/3-capabilities/general-files/persistence/sqliteGeneralFileRepository.js";
import { registerGeneralFileEndpoints } from "../../src/4-job-wiring/general-files/registerGeneralFileEndpointMappings.js";
import { CapturingLogger, ZERO_USAGE } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "../../src/0-utils/persistence/resourceHistory.js";

const createHarness = () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-general-files-"));
  const calls = { added: [] as string[], removed: [] as string[] };
  const knowledge = {
    add: async ({ sourceId }: { sourceId: string }) => {
      calls.added.push(sourceId);
      return {
        sourceId,
        skipped: false,
        windowsAdded: 1,
        windowsReused: 0,
        usage: ZERO_USAGE
      };
    },
    remove: async (sourceId: string) => {
      calls.removed.push(sourceId);
    }
  } as unknown as Knowledge;
  const logger = new CapturingLogger();
  const store = new SQLiteGeneralFileStore("test-project", join(directory, "files.db"));
  return {
    calls,
    logger,
    store,
    service: createGeneralFileService(store, knowledge, logger)
  };
};

test("all General Files mutation endpoints use the serial queue", () => {
  const registry = new JobRegistry();
  registerGeneralFileEndpoints(registry, {} as never, new CapturingLogger());

  for (const path of [
    "/general-files/upload",
    "/general-files/update",
    "/general-files/delete",
    "/general-files/purge",
  ]) {
    const job = registry.createJob({
      requestId: `request-${path}`,
      method: "POST",
      path,
      params: {},
      query: {},
      headers: {},
      body: {},
    });
    assert.equal(job.queueType, "serial", path);
  }
});

test("upload is content-addressed, idempotent, logged, and excludes content from list", async () => {
  const { logger, service } = createHarness();
  const first = await service.upload({ fileName: "notes.txt", content: "plain text" });
  const second = await service.upload({ fileName: "copy.txt", content: "plain text" });

  assert.equal(first.kind, "created");
  assert.equal(second.kind, "reused");
  assert.equal(first.file.id, second.file.id);
  assert.equal("content" in service.list()[0], false);
  assert.ok(logger.entries.some((entry) => entry.message === "general-files.upload"));
});

test("text uploads persist multibyte UTF-8 and report byte size", async () => {
  const { service } = createHarness();
  const content = "Résumé 🌍";
  const result = await service.upload({ fileName: "unicode.md", content });

  assert.equal(result.kind, "created");
  assert.equal(result.file.byteSize, Buffer.byteLength(content, "utf8"));
  assert.equal(service.get(result.file.id).content, content);
});

test("files without an extension are accepted as general::file::other", async () => {
  const { service } = createHarness();
  const result = await service.upload({ fileName: "README", content: "opaque" });

  assert.equal(result.kind, "created");
  assert.equal(result.file.kind, "general::file::other");
  assert.equal(result.file.extension, "");
});

test("binary document containers stay out of Knowledge until extraction exists", async () => {
  const { calls, service } = createHarness();
  const pdf = await service.upload({ fileName: "report.pdf", content: "%PDF-opaque" });
  const docx = await service.upload({ fileName: "report.docx", content: "PK-opaque" });

  assert.equal(pdf.file.kind, "general::file::other");
  assert.equal(docx.file.kind, "general::file::other");
  assert.deepEqual(calls.added, []);
});

test("updating content atomically creates a linked replacement", async () => {
  const { calls, service, store } = createHarness();
  const original = await service.upload({ fileName: "notes.txt", content: "version one" });
  const updated = await service.update(original.file.id, { content: "version two" });

  assert.equal(updated.kind, "updated");
  assert.equal(updated.file.replacesId, original.file.id);
  assert.notEqual(updated.file.id, original.file.id);
  assert.deepEqual(calls.removed, [`general-file:${original.file.id}`]);
  assert.throws(() => service.get(original.file.id), /not found/i);
  assert.equal(store.history(original.file.id)[0]?.snapshot?.replacedById, updated.file.id);
  assert.equal(store.getById(updated.file.id)?.replacesId, original.file.id);
  assert.equal(updated.file.revision, 1);
});

test("delete removes Knowledge and deterministic re-registration advances until purge", async () => {
  const { calls, service, store } = createHarness();
  const original = await service.upload({ fileName: "notes.txt", content: "register again" });

  await assert.rejects(() => service.purge(original.file.id), ResourceNotDeletedError);

  await service.delete(original.file.id);
  assert.deepEqual(calls.removed, [`general-file:${original.file.id}`]);
  assert.throws(() => service.get(original.file.id), /not found/i);
  assert.deepEqual(store.history(original.file.id).map((record) => [record.revision, record.recordType]), [
    [1, "snapshot"],
    [2, "deleted"]
  ]);

  const registeredAgain = await service.upload({ fileName: "notes.txt", content: "register again" });
  assert.equal(registeredAgain.kind, "created");
  assert.equal(registeredAgain.file.id, original.file.id);
  assert.equal(registeredAgain.file.revision, 3);

  await service.delete(original.file.id);
  await service.purge(original.file.id);
  assert.deepEqual(store.history(original.file.id), []);
  await assert.rejects(() => service.purge(original.file.id), ResourceHistoryNotFoundError);

  const registeredAfterPurge = await service.upload({
    fileName: "notes.txt",
    content: "register again"
  });
  assert.equal(registeredAfterPurge.file.id, original.file.id);
  assert.equal(registeredAfterPurge.file.revision, 1);
});

test("a failed Knowledge admission leaves no active file and can be retried", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-general-files-failure-"));
  const store = new SQLiteGeneralFileStore("test-project", join(directory, "files.db"));
  let shouldFail = true;
  const knowledge = {
    add: async ({ sourceId }: { sourceId: string }) => {
      if (shouldFail) throw new Error("embedding unavailable");
      return {
        sourceId,
        skipped: false,
        windowsAdded: 1,
        windowsReused: 0,
        usage: ZERO_USAGE
      };
    },
    remove: async () => undefined
  } as unknown as Knowledge;
  const service = createGeneralFileService(store, knowledge, new CapturingLogger());

  await assert.rejects(
    service.upload({ fileName: "notes.txt", content: "retryable" }),
    /embedding unavailable/
  );
  assert.equal(store.list().length, 0);

  shouldFail = false;
  const retried = await service.upload({ fileName: "notes.txt", content: "retryable" });
  assert.equal(retried.kind, "created");
  assert.equal(store.list().length, 1);
});

test("updating to existing content removes the replaced Knowledge source", async () => {
  const { calls, service } = createHarness();
  const first = await service.upload({ fileName: "first.txt", content: "first" });
  const target = await service.upload({ fileName: "target.txt", content: "target" });

  const updated = await service.update(first.file.id, { content: "target" });

  assert.equal(updated.file.id, target.file.id);
  assert.ok(calls.removed.includes(`general-file:${first.file.id}`));
  assert.throws(() => service.get(first.file.id), /not found/i);
});

test("a replacement Knowledge failure leaves the previous version active", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-general-files-rollback-"));
  const store = new SQLiteGeneralFileStore("test-project", join(directory, "files.db"));
  let oldSourceId = "";
  let failOldRemoval = true;
  const knowledge = {
    add: async ({ sourceId }: { sourceId: string }) => {
      oldSourceId ||= sourceId;
      return {
        sourceId,
        skipped: false,
        windowsAdded: 1,
        windowsReused: 0,
        usage: ZERO_USAGE
      };
    },
    remove: async (sourceId: string) => {
      if (sourceId === oldSourceId && failOldRemoval) {
        failOldRemoval = false;
        throw new Error("remove unavailable");
      }
    }
  } as unknown as Knowledge;
  const service = createGeneralFileService(store, knowledge, new CapturingLogger());
  const original = await service.upload({ fileName: "notes.txt", content: "old" });

  await assert.rejects(service.update(original.file.id, { content: "new" }), /remove unavailable/);

  assert.equal(service.get(original.file.id).content, "old");
  assert.equal(store.list().length, 1);
  assert.equal(store.getById(original.file.id)?.replacedById, undefined);
});

test("a losing competing update cannot resurrect the replaced Knowledge source", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-general-files-competing-update-"));
  const store = new SQLiteGeneralFileStore("test-project", join(directory, "files.db"));
  const activeSources = new Set<string>();
  let originalSourceId = "";
  let originalAddCount = 0;
  let competingAdds = 0;
  let releaseCompetingAdds!: () => void;
  const bothCompetingAddsStarted = new Promise<void>((resolve) => {
    releaseCompetingAdds = resolve;
  });
  const addResult = (sourceId: string) => ({
    sourceId,
    skipped: false,
    windowsAdded: 1,
    windowsReused: 0,
    usage: ZERO_USAGE,
  });
  const knowledge = {
    add: async ({ sourceId }: { sourceId: string }) => {
      activeSources.add(sourceId);
      if (!originalSourceId) {
        originalSourceId = sourceId;
        originalAddCount += 1;
        return addResult(sourceId);
      }
      if (sourceId === originalSourceId) {
        originalAddCount += 1;
        return addResult(sourceId);
      }

      competingAdds += 1;
      if (competingAdds === 2) releaseCompetingAdds();
      await bothCompetingAddsStarted;
      return addResult(sourceId);
    },
    remove: async (sourceId: string) => {
      activeSources.delete(sourceId);
    },
  } as unknown as Knowledge;
  const service = createGeneralFileService(store, knowledge, new CapturingLogger());
  const original = await service.upload({ fileName: "notes.txt", content: "original" });

  const outcomes = await Promise.allSettled([
    service.update(original.file.id, { content: "first competitor" }),
    service.update(original.file.id, { content: "second competitor" }),
  ]);

  const winners = outcomes.filter((outcome) => outcome.status === "fulfilled");
  const losers = outcomes.filter((outcome) => outcome.status === "rejected");
  assert.equal(winners.length, 1);
  assert.equal(losers.length, 1);
  const winner = winners[0];
  assert.equal(winner.status, "fulfilled");
  const winnerSourceId = `general-file:${winner.value.file.id}`;
  assert.deepEqual([...activeSources], [winnerSourceId]);
  assert.equal(activeSources.has(originalSourceId), false);
  assert.equal(originalAddCount, 1, "the losing update re-admitted the retired source");
  assert.deepEqual(store.list().map((file) => file.id), [winner.value.file.id]);
});
