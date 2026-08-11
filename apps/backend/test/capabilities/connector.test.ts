import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { Knowledge } from "../../src/capabilities/knowledge/knowledge.js";
import { ConnectorSyncScheduler } from "../../src/initialization/runtimes/connectorSyncScheduler.js";
import { JobRegistry } from "../../src/workflows/registry.js";
import { JobScheduler } from "../../src/workflows/scheduler.js";
import { createConnectorService } from "../../src/capabilities/connector/application/connectorService.js";
import {
  ConnectorNotFoundError,
  SyncInProgressError,
} from "../../src/capabilities/connector/domain/errors.js";
import type { ConnectorProvider } from "../../src/capabilities/connector/domain/provider.js";
import type { ConnectorStore } from "../../src/capabilities/connector/ports/repository.js";
import { SQLiteConnectorStore } from "../../src/capabilities/connector/persistence/sqliteConnectorRepository.js";
import { filesystemProvider } from "../../src/capabilities/connector/providers/filesystem.js";
import { registerConnectorEndpoints } from "../../src/api/routes/connector/registerConnectorEndpointMappings.js";
import { CapturingLogger, ZERO_USAGE } from "../helpers/testDoubles.js";
import {
  ResourceHistoryNotFoundError,
  ResourceNotDeletedError
} from "../../src/shared/persistence/resourceHistory.js";

const createKnowledge = () => {
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
  return { calls, knowledge };
};

const createStore = (): SQLiteConnectorStore => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-connector-db-"));
  return new SQLiteConnectorStore("test-project", join(directory, "connector.db"));
};

test("the public /connector/list endpoint is registered with an absolute path", () => {
  const endpointSource = readFileSync(
    new URL(
      "../../src/api/routes/connector/registerConnectorEndpointMappings.ts",
      import.meta.url
    ),
    "utf8"
  );
  assert.equal(
    /path:\s*["']\/connector\/list["']/.test(endpointSource),
    true,
    "POST /connector/list is not registered with its transport path"
  );
});

test("filesystem connectors accept extensionless non-prose files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-connector-source-"));
  const filePath = join(directory, "README");
  writeFileSync(filePath, "opaque");
  const { knowledge } = createKnowledge();
  const service = createConnectorService(
    createStore(),
    knowledge,
    new Map([[filesystemProvider.kind, filesystemProvider]]),
    new CapturingLogger()
  );

  const result = await service.register({
    providerKind: "filesystem",
    locator: filePath,
    syncInterval: "5min"
  });

  assert.equal(result.status, "registered");
  assert.equal(result.entry.kind, "connector::file::other");
  assert.deepEqual(result.entry.syncConfig, { syncType: "scheduled", interval: "5min" });
});

test("filesystem readers validate bounds and preserve UTF-8 across stream chunks", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-connector-reader-"));
  const filePath = join(directory, "unicode.txt");
  const content = "A🌍B";
  writeFileSync(filePath, content);
  const item = (await filesystemProvider.listItems(filePath))[0];
  const reader = await filesystemProvider.getReader(filePath, item.key);

  await assert.rejects(reader.read({ start: -1, end: 1 }), RangeError);
  await assert.rejects(
    reader.read({ start: 0, end: reader.byteSize + 1 }),
    /exceeds byteSize/
  );

  let streamed = "";
  for await (const chunk of reader.readStream(1)) streamed += chunk;
  assert.equal(streamed, content);
});

test("sync removes Knowledge content when an item changes from prose to other", async () => {
  const store = createStore();
  const { calls, knowledge } = createKnowledge();
  let prose = true;
  const provider: ConnectorProvider = {
    kind: "test",
    label: "Test",
    listItems: async () => [{
      key: "item",
      name: prose ? "item.md" : "renamed.bin",
      extension: prose ? "md" : "bin",
      byteSize: prose ? 4 : 9,
      revisionToken: prose ? "v1" : "v2",
      status: prose ? "prose" : "other"
    }],
    getReader: async () => ({
      byteSize: 4,
      mimeType: "text/plain",
      read: async () => "text",
      readAll: async () => "text",
      async *readStream() { yield "text"; },
      readLines: async () => ["text"]
    })
  };
  const service = createConnectorService(
    store,
    knowledge,
    new Map([[provider.kind, provider]]),
    new CapturingLogger()
  );
  const registered = await service.register({
    providerKind: "test" as "filesystem",
    locator: "ignored"
  });
  prose = false;

  await service.sync(registered.entry.id);

  assert.deepEqual(calls.removed, [registered.entry.knowledgeSourceIds[0]]);
  const syncedItem = store.getItems(registered.entry.id)[0];
  assert.equal(syncedItem.knowledgeSourceId, null);
  assert.equal(syncedItem.name, "renamed.bin");
  assert.equal(syncedItem.extension, "bin");
  assert.equal(syncedItem.byteSize, 9);
  assert.deepEqual(service.get(registered.entry.id).knowledgeSourceIds, []);
});

test("failed sync records reconciliation state without fabricating old Knowledge", async () => {
  type SnapshotItem = {
    key: string;
    name: string;
    revisionToken: string;
    text: string;
  };
  const initial: SnapshotItem[] = [
    { key: "kept", name: "kept.md", revisionToken: "v1", text: "old text" },
    { key: "removed", name: "removed.md", revisionToken: "v1", text: "removed text" },
  ];
  const changed: SnapshotItem[] = [
    { key: "kept", name: "kept.md", revisionToken: "v2", text: "new text" },
    { key: "temporary", name: "temporary.md", revisionToken: "v1", text: "temporary text" },
  ];
  let snapshot = initial;
  const provider: ConnectorProvider = {
    kind: "reconciliation-test",
    label: "Reconciliation test",
    listItems: async () => snapshot.map(item => ({
      key: item.key,
      name: item.name,
      extension: "md",
      byteSize: Buffer.byteLength(item.text),
      revisionToken: item.revisionToken,
      status: "prose" as const,
    })),
    getReader: async (_locator, itemKey) => {
      const item = snapshot.find(candidate => candidate.key === itemKey);
      if (!item) throw new Error(`provider no longer has ${itemKey}`);
      return {
        byteSize: Buffer.byteLength(item.text),
        mimeType: "text/plain",
        read: async () => item.text,
        readAll: async () => item.text,
        async *readStream() { yield item.text; },
        readLines: async () => [item.text],
      };
    },
  };
  const additions: Array<{ sourceId: string; revision: string; text: string }> = [];
  const indexed = new Map<string, { revision: string; text: string }>();
  let removalFailureSourceId = "";
  let failRemoval = true;
  const knowledge = {
    add: async ({ sourceId, revision, text }: {
      sourceId: string;
      revision: string;
      text: string;
    }) => {
      additions.push({ sourceId, revision, text });
      indexed.set(sourceId, { revision, text });
      return {
        sourceId,
        skipped: false,
        windowsAdded: 1,
        windowsReused: 0,
        usage: ZERO_USAGE,
      };
    },
    remove: async (sourceId: string) => {
      if (sourceId === removalFailureSourceId && failRemoval) {
        failRemoval = false;
        throw new Error("Knowledge removal unavailable");
      }
      indexed.delete(sourceId);
    },
  } as unknown as Knowledge;
  const store = createStore();
  const service = createConnectorService(
    store,
    knowledge,
    new Map([[provider.kind, provider]]),
    new CapturingLogger()
  );
  const registered = await service.register({
    providerKind: provider.kind as "filesystem",
    locator: "ignored",
  });
  const initialItems = store.getItems(registered.entry.id);
  removalFailureSourceId = initialItems.find(item => item.itemKey === "removed")!.knowledgeSourceId!;
  const keptSourceId = initialItems.find(item => item.itemKey === "kept")!.knowledgeSourceId!;
  snapshot = changed;

  await assert.rejects(service.sync(registered.entry.id), /Knowledge removal unavailable/);

  const failed = store.getById(registered.entry.id)!;
  assert.equal(failed.ingestionState, "failed");
  assert.equal(failed.revision, registered.entry.revision);
  assert.equal(service.get(registered.entry.id).ingestionState, "failed");
  assert.deepEqual(
    service.get(registered.entry.id).knowledgeSourceIds,
    [],
    "failed reconciliation leaked uncertain sources into Knowledge scope"
  );
  assert.deepEqual(
    store.getItems(registered.entry.id).map(item => [item.itemKey, item.revisionToken]),
    [["kept", "v1"], ["removed", "v1"]]
  );
  assert.equal(failed.knowledgeSourceIds.length, 3, "retry lost a touched source ID");
  assert.equal(
    additions.some(addition =>
      addition.sourceId === keptSourceId &&
      addition.revision === "v1" &&
      addition.text === "new text"
    ),
    false,
    "current provider bytes were mislabeled as the old revision"
  );

  // The provider changes again before retry: the pending temporary item is
  // gone. The tracked source union must still remove its orphaned Knowledge.
  snapshot = [changed[0]];
  await service.sync(registered.entry.id);

  const reconciled = store.getById(registered.entry.id)!;
  assert.equal(reconciled.ingestionState, "active");
  assert.deepEqual(
    store.getItems(registered.entry.id).map(item => [item.itemKey, item.revisionToken]),
    [["kept", "v2"]]
  );
  assert.deepEqual([...indexed], [[keptSourceId, { revision: "v2", text: "new text" }]]);
});

test("scheduler discovers persisted scheduled connectors when it starts", () => {
  let listCalls = 0;
  let resetCalls = 0;
  const store = {
    resetSyncing: () => {
      resetCalls += 1;
      return 2;
    },
    listSyncableEntries: () => {
      listCalls += 1;
      return [];
    }
  } as unknown as ConnectorStore;
  const logger = new CapturingLogger();
  const scheduler = new ConnectorSyncScheduler(
    store,
    new JobScheduler({
      concurrentWorkers: 1,
      serialQueueMaxSize: 10,
      concurrentQueueMaxSize: 10
    }),
    { sync: async () => undefined } as never,
    logger
  );

  scheduler.start();
  scheduler.stop();

  assert.equal(listCalls, 1);
  assert.equal(resetCalls, 1);
  const recovery = logger.entries.find(entry => entry.message === "connector.sync.scheduler.recovered");
  assert.deepEqual(recovery?.data, { connectors: 2 });
});

test("deterministic Connector registration advances history until physical purge", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-connector-reregistration-"));
  const filePath = join(directory, "notes.txt");
  writeFileSync(filePath, "indexed prose");
  const { calls, knowledge } = createKnowledge();
  const store = createStore();
  const service = createConnectorService(
    store,
    knowledge,
    new Map([[filesystemProvider.kind, filesystemProvider]]),
    new CapturingLogger()
  );
  const first = await service.register({ providerKind: "filesystem", locator: filePath });
  await assert.rejects(() => service.purge(first.entry.id), ResourceNotDeletedError);

  await service.delete(first.entry.id);
  assert.deepEqual(calls.removed, first.entry.knowledgeSourceIds);
  assert.equal(store.getById(first.entry.id), undefined);
  assert.deepEqual(store.history(first.entry.id).map((record) => [record.revision, record.recordType]), [
    [1, "snapshot"],
    [2, "deleted"]
  ]);
  const registeredAgain = await service.register({ providerKind: "filesystem", locator: filePath });

  assert.equal(registeredAgain.status, "registered");
  assert.equal(registeredAgain.entry.id, first.entry.id);
  assert.equal(registeredAgain.entry.revision, 3);

  await service.delete(first.entry.id);
  await service.purge(first.entry.id);
  assert.deepEqual(store.history(first.entry.id), []);
  await assert.rejects(() => service.purge(first.entry.id), ResourceHistoryNotFoundError);

  const registeredAfterPurge = await service.register({
    providerKind: "filesystem",
    locator: filePath
  });
  assert.equal(registeredAfterPurge.entry.id, first.entry.id);
  assert.equal(registeredAfterPurge.entry.revision, 1);
});

test("delete holds the sync claim and a stale sync update cannot resurrect the connector", async () => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-connector-delete-sync-race-"));
  const filePath = join(directory, "notes.txt");
  writeFileSync(filePath, "prose");
  const store = createStore();
  let signalRemovalStarted!: () => void;
  let releaseRemoval!: () => void;
  const removalStarted = new Promise<void>((resolve) => {
    signalRemovalStarted = resolve;
  });
  const removalReleased = new Promise<void>((resolve) => {
    releaseRemoval = resolve;
  });
  const knowledge = {
    add: async ({ sourceId }: { sourceId: string }) => ({
      sourceId,
      skipped: false,
      windowsAdded: 1,
      windowsReused: 0,
      usage: ZERO_USAGE,
    }),
    remove: async () => {
      signalRemovalStarted();
      await removalReleased;
    },
  } as unknown as Knowledge;
  const service = createConnectorService(
    store,
    knowledge,
    new Map([[filesystemProvider.kind, filesystemProvider]]),
    new CapturingLogger()
  );
  const registered = await service.register({ providerKind: "filesystem", locator: filePath });
  const staleItems = store.getItems(registered.entry.id);

  const deletion = service.delete(registered.entry.id);
  await removalStarted;
  assert.equal(store.getById(registered.entry.id)?.syncing, true);

  const [syncOutcome] = await Promise.allSettled([service.sync(registered.entry.id)]);
  releaseRemoval();
  await deletion;

  assert.equal(syncOutcome.status, "rejected");
  if (syncOutcome.status === "rejected") {
    assert.ok(syncOutcome.reason instanceof SyncInProgressError);
  }
  const deleted = store.getById(registered.entry.id);
  assert.equal(deleted, undefined);
  assert.deepEqual(store.history(registered.entry.id).map((record) => [record.revision, record.recordType]), [
    [registered.entry.revision, "snapshot"],
    [registered.entry.revision + 1, "deleted"]
  ]);

  assert.throws(
    () => store.update(
      { ...registered.entry, revision: 2, syncing: true },
      staleItems,
      { entry: registered.entry, items: staleItems }
    ),
    /lost its current sync state/
  );
  assert.equal(store.getById(registered.entry.id), undefined);
  assert.throws(() => service.get(registered.entry.id), ConnectorNotFoundError);
});

test("manual refresh is inline and reports validation errors", async () => {
  const registry = new JobRegistry();
  registerConnectorEndpoints(
    registry,
    { sync: async (id: string) => { throw new ConnectorNotFoundError(id); } } as never,
    new CapturingLogger()
  );
  const job = registry.createJob({
    requestId: "request-1",
    method: "POST",
    path: "/connector/refresh",
    params: {},
    query: {},
    headers: {},
    body: { id: "missing" }
  });

  assert.equal(job.responseMode, "inline");
  if (job.responseMode !== "inline") return;
  const response = await job.work();
  assert.equal(response.statusCode, 404);
});
