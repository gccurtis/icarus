import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import type { Intelligence } from "../../src/0-platform/intelligence/intelligence.js";
import type { Usage } from "../../src/0-platform/intelligence/types.js";
import type { Embedder } from "../../src/0-platform/knowledge/embedder.js";
import { Knowledge } from "../../src/0-platform/knowledge/knowledge.js";
import type { KnowledgeStore } from "../../src/0-platform/knowledge/store.js";
import type {
  ContextEntry,
  KnowledgeResourceDescriptor,
  KnowledgeScopeManifest,
  Region,
  SourceRecord
} from "../../src/0-platform/knowledge/types.js";
import { createResourceReader } from "../../src/1-init/create/resource-reader.js";
import type { ContextManager } from "../../src/3-capabilities/context/context.js";
import type { ConnectorService } from "../../src/3-capabilities/connector/application/connectorService.js";
import type {
  ConnectorEntry,
  ConnectorItemEntry
} from "../../src/3-capabilities/connector/domain/model.js";
import {
  createDerivedOutputService,
  type ResourceReader
} from "../../src/3-capabilities/derived-outputs/derived-outputs.js";
import {
  DerivedOutputDefinitionUpdateIdempotencyConflictError,
  DerivedOutputNotFoundError,
  DerivedOutputRefreshIdempotencyConflictError,
  StaleDefinitionRevisionError
} from "../../src/3-capabilities/derived-outputs/domain/model.js";
import { SQLiteDerivedOutputStore } from "../../src/3-capabilities/derived-outputs/sqlite-store.js";
import { createGeneralFileService } from "../../src/3-capabilities/general-files/application/generalFileService.js";
import { SQLiteGeneralFileStore } from "../../src/3-capabilities/general-files/persistence/sqliteGeneralFileRepository.js";
import { CapturingLogger, ZERO_USAGE } from "../helpers/testDoubles.js";

const PROJECT_ID = "test-project";

const createStoreFixture = (): {
  store: SQLiteDerivedOutputStore;
  dbPath: string;
} => {
  const directory = mkdtempSync(join(tmpdir(), "icarus-derived-outputs-"));
  const dbPath = join(directory, "derived.db");
  return {
    store: new SQLiteDerivedOutputStore(PROJECT_ID, dbPath),
    dbPath
  };
};

const createStore = (): SQLiteDerivedOutputStore => createStoreFixture().store;

const makeManifest = (
  resources: readonly KnowledgeResourceDescriptor[] = [],
  inputEntries: readonly ContextEntry[] = []
): KnowledgeScopeManifest => Object.freeze({
  inputEntries: Object.freeze(inputEntries.map((entry) => Object.freeze({ ...entry }))),
  resolvedEntries: Object.freeze(
    resources.map((resource) => Object.freeze({
      id: resource.sourceId,
      kind: "document"
    }))
  ),
  resources: Object.freeze(resources.map((resource) => Object.freeze({ ...resource }))),
  resolvedSourceIds: Object.freeze(resources.map((resource) => resource.sourceId).sort()),
  contextDigest: "context-digest",
  scopeDigest: "scope-digest",
  resolvedAt: "2026-08-01T00:00:00.000Z"
});

const EMPTY_MANIFEST = makeManifest();

const makeResourceReader = (): ResourceReader => ({
  describeSource: async () => null,
  list: async (scope) => scope.resources,
  read: async () => null
});

const makeKnowledge = (
  manifest: KnowledgeScopeManifest,
  retrieve: (
    query: string,
    options?: { scopeManifest?: KnowledgeScopeManifest | null }
  ) => Promise<{ regions: Region[]; scope: KnowledgeScopeManifest; usage: Usage }>,
  onResolve?: (entries: ContextEntry[]) => void
): Knowledge => ({
  resolveScope: async (entries?: ContextEntry[]) => {
    onResolve?.(entries ?? []);
    return manifest;
  },
  retrieve
}) as unknown as Knowledge;

const noEvidenceKnowledge = (
  onResolve?: (entries: ContextEntry[]) => void
): Knowledge => makeKnowledge(
  EMPTY_MANIFEST,
  async () => ({ regions: [], scope: EMPTY_MANIFEST, usage: ZERO_USAGE }),
  onResolve
);

const createEventedKnowledge = (logger: CapturingLogger): Knowledge => {
  const sources = new Map<string, SourceRecord>();
  const store: KnowledgeStore = {
    getSource: async (sourceId) => sources.get(sourceId),
    putSource: async (source) => {
      sources.set(source.sourceId, source);
    },
    deleteSource: async (sourceId) => {
      sources.delete(sourceId);
    },
    listSources: async () => [...sources.values()],
    getWindows: async () => [],
    putWindows: async () => undefined,
    deleteWindowsForSource: async () => undefined,
    getNodes: async () => [],
    putNodes: async () => undefined,
    deleteNodesForSource: async () => undefined,
    deleteCorpusNodes: async () => undefined,
    getSourceNodeIds: async () => [],
    getFrontier: async () => [],
    putFrontier: async () => undefined,
    getLevelIndex: async () => undefined,
    putLevelIndex: async () => undefined,
    deleteLevelIndex: async () => undefined
  };
  const embedder: Embedder = {
    embed: async (inputs) => ({
      vectors: inputs.map(() => [1]),
      usage: ZERO_USAGE
    })
  };
  return new Knowledge(store, embedder, logger);
};

const deferred = <T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
} => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

test("a no-evidence refresh atomically publishes an insufficient revision and telemetry", async (t) => {
  const logger = new CapturingLogger();
  const store = createStore();
  t.after(() => store.close());
  const intelligence = {
    reasonStructured: async () => ({
      structured: { queries: ["answer"] },
      usage: ZERO_USAGE
    })
  } as unknown as Intelligence;
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    logger
  );
  const output = await service.declare({ prompt: "What is the answer?" });
  const result = await service.refresh(output.id);

  assert.equal(result.skipped, false);
  assert.equal(result.output.headRevision, 1);
  assert.equal(result.output.freshness.state, "current");
  assert.equal(result.revision?.status, "insufficient");
  assert.match(result.revision?.content ?? "", /no evidence/i);
  assert.ok(logger.entries.some((entry) => {
    if (entry.message !== "derived-outputs.refresh.completed") return false;
    const data = entry.data as Record<string, unknown>;
    return data.path === "no_evidence" &&
      data.outcome === "published" &&
      typeof data.durationMs === "number" &&
      typeof data.totalTokens === "number";
  }));
});

test("a keyed refresh replays its exact published result after reopening the store", async (t) => {
  const { store: firstStore, dbPath } = createStoreFixture();
  let planningCalls = 0;
  const firstService = createDerivedOutputService(
    firstStore,
    noEvidenceKnowledge(),
    {
      reasonStructured: async () => {
        planningCalls += 1;
        return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
      }
    } as unknown as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await firstService.declare({ prompt: "Replay me" });
  const first = await firstService.refresh(output.id, {
    idempotencyKey: "document:prompt-refresh:attempt-1"
  });
  firstStore.close();

  const reopenedStore = new SQLiteDerivedOutputStore(PROJECT_ID, dbPath);
  t.after(() => reopenedStore.close());
  const replayService = createDerivedOutputService(
    reopenedStore,
    noEvidenceKnowledge(),
    {
      reasonStructured: async () => {
        assert.fail("a completed keyed refresh must not repeat provider work");
      }
    } as unknown as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const replayed = await replayService.refresh(output.id, {
    idempotencyKey: "document:prompt-refresh:attempt-1"
  });

  assert.deepEqual(replayed, first);
  assert.equal(replayed.output.headRevision, 1);
  assert.equal(replayed.revision?.revision, 1);
  assert.equal(planningCalls, 1);
});

test("a keyed skipped refresh is persisted and replayed without provider work", async (t) => {
  const store = createStore();
  t.after(() => store.close());
  const planningStarted = deferred<void>();
  const releasePlanning = deferred<void>();
  let planningCalls = 0;
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    {
      reasonStructured: async () => {
        planningCalls += 1;
        planningStarted.resolve();
        await releasePlanning.promise;
        return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
      }
    } as unknown as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await service.declare({ prompt: "Fence me" });
  const pending = service.refresh(output.id, {
    idempotencyKey: "document:prompt-refresh:attempt-skipped"
  });
  await planningStarted.promise;
  store.markAllOutputsStaleForKnowledgeChange("2026-08-01T01:00:00.000Z");
  releasePlanning.resolve();
  const skipped = await pending;

  assert.equal(skipped.skipped, true);
  assert.equal(skipped.revision, undefined);
  assert.equal(skipped.output.headRevision, 0);

  const replayed = await service.refresh(output.id, {
    idempotencyKey: "document:prompt-refresh:attempt-skipped"
  });
  assert.deepEqual(replayed, skipped);
  assert.equal(planningCalls, 1);
});

test("a refresh key rejects reuse for a different output", async (t) => {
  const store = createStore();
  t.after(() => store.close());
  let planningCalls = 0;
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    {
      reasonStructured: async () => {
        planningCalls += 1;
        return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
      }
    } as unknown as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const first = await service.declare({ prompt: "First" });
  const second = await service.declare({ prompt: "Second" });
  const key = "document:prompt-refresh:shared-key";
  await service.refresh(first.id, { idempotencyKey: key });

  await assert.rejects(
    service.refresh(second.id, { idempotencyKey: key }),
    (error) => error instanceof DerivedOutputRefreshIdempotencyConflictError &&
      error.idempotencyKey === key
  );
  assert.equal(planningCalls, 1);
});

test("unkeyed refreshes retain their existing repeatable behavior", async (t) => {
  const store = createStore();
  t.after(() => store.close());
  let planningCalls = 0;
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    {
      reasonStructured: async () => {
        planningCalls += 1;
        return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
      }
    } as unknown as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await service.declare({ prompt: "Refresh twice" });

  const first = await service.refresh(output.id);
  const second = await service.refresh(output.id);

  assert.equal(first.output.headRevision, 1);
  assert.equal(second.output.headRevision, 2);
  assert.equal(planningCalls, 2);
});

test("a keyed definition update replays its exact result after later edits and restart", async (t) => {
  const { store: firstStore, dbPath } = createStoreFixture();
  const firstService = createDerivedOutputService(
    firstStore,
    noEvidenceKnowledge(),
    {} as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await firstService.declare({ prompt: "Original" });
  const request = {
    prompt: "First update",
    contextEntries: [{ id: "document-1", kind: "document" }],
    stabilisationText: "Stable first result",
    expectedDefinitionRevision: 1
  };
  const first = await firstService.updateDefinition(output.id, request, {
    idempotencyKey: "document:prompt-definition:request-1"
  });
  const later = await firstService.updateDefinition(output.id, {
    prompt: "Later update",
    contextEntries: [],
    stabilisationText: "Later result",
    expectedDefinitionRevision: 2
  });
  assert.equal(later.definition.definitionRevision, 3);
  firstStore.close();

  const reopenedStore = new SQLiteDerivedOutputStore(PROJECT_ID, dbPath);
  t.after(() => reopenedStore.close());
  const reopenedService = createDerivedOutputService(
    reopenedStore,
    noEvidenceKnowledge(),
    {} as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const replayed = await reopenedService.updateDefinition(output.id, request, {
    idempotencyKey: "document:prompt-definition:request-1"
  });

  assert.deepEqual(replayed, first);
  assert.equal(replayed.definition.definitionRevision, 2);
  assert.equal(replayed.definition.prompt, "First update");
  assert.equal(
    (await reopenedService.get(output.id))?.definition.definitionRevision,
    3
  );
});

test("a definition-update key rejects divergent input and output reuse", async (t) => {
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    {} as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const first = await service.declare({ prompt: "First" });
  const second = await service.declare({ prompt: "Second" });
  const key = "document:prompt-definition:shared-key";
  const request = {
    prompt: "Updated",
    contextEntries: [],
    stabilisationText: "",
    expectedDefinitionRevision: 1
  };
  await service.updateDefinition(first.id, request, { idempotencyKey: key });

  await assert.rejects(
    service.updateDefinition(first.id, { ...request, prompt: "Divergent" }, {
      idempotencyKey: key
    }),
    (error) =>
      error instanceof DerivedOutputDefinitionUpdateIdempotencyConflictError &&
      error.idempotencyKey === key
  );
  await assert.rejects(
    service.updateDefinition(second.id, request, { idempotencyKey: key }),
    DerivedOutputDefinitionUpdateIdempotencyConflictError
  );
});

test("unkeyed definition updates retain their existing CAS behavior", async (t) => {
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    {} as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await service.declare({ prompt: "Original" });
  const first = await service.updateDefinition(output.id, {
    prompt: "Revision two",
    contextEntries: [],
    stabilisationText: "",
    expectedDefinitionRevision: 1
  });
  const second = await service.updateDefinition(output.id, {
    prompt: "Revision three",
    contextEntries: [],
    stabilisationText: "",
    expectedDefinitionRevision: 2
  });

  assert.equal(first.definition.definitionRevision, 2);
  assert.equal(second.definition.definitionRevision, 3);
});

test("definition update is one SQLite CAS that also marks freshness stale", async (t) => {
  const { store: firstStore, dbPath } = createStoreFixture();
  const secondStore = new SQLiteDerivedOutputStore(PROJECT_ID, dbPath);
  t.after(() => {
    secondStore.close();
    firstStore.close();
  });
  const firstService = createDerivedOutputService(
    firstStore,
    noEvidenceKnowledge(),
    {} as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const secondService = createDerivedOutputService(
    secondStore,
    noEvidenceKnowledge(),
    {} as Intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await firstService.declare({ prompt: "Original" });
  const request = (prompt: string) => ({
    prompt,
    contextEntries: [],
    stabilisationText: "",
    expectedDefinitionRevision: 1
  });

  const results = await Promise.allSettled([
    firstService.updateDefinition(output.id, request("Writer A")),
    secondService.updateDefinition(output.id, request("Writer B"))
  ]);
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof firstService.updateDefinition>>> =>
      result.status === "fulfilled"
  );
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected"
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason instanceof StaleDefinitionRevisionError);
  assert.equal(fulfilled[0].value.definition.definitionRevision, 2);
  assert.equal(fulfilled[0].value.freshness.state, "stale");
  assert.ok(fulfilled[0].value.freshness.staleSince);

  const persisted = await secondService.get(output.id);
  assert.equal(persisted?.definition.definitionRevision, 2);
  assert.equal(persisted?.freshness.state, "stale");
});

test("delete atomically removes output history, attempts, and declaration claim", async (t) => {
  const { store, dbPath } = createStoreFixture();
  t.after(() => store.close());
  const intelligence = {
    reasonStructured: async () => ({
      structured: { queries: ["answer"] },
      usage: ZERO_USAGE
    })
  } as unknown as Intelligence;
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const declaration = { prompt: "Delete me" };
  const output = await service.declare(declaration, {
    idempotencyKey: "delete-claim"
  });
  await service.updateDefinition(output.id, {
    prompt: "Delete me after an update",
    contextEntries: [],
    stabilisationText: "",
    expectedDefinitionRevision: 1
  }, { idempotencyKey: "delete-definition-update" });
  await service.refresh(output.id, { idempotencyKey: "delete-refresh" });

  const inspection = new Database(dbPath, { readonly: true });
  t.after(() => inspection.close());
  const prefix = createHash("sha256")
    .update(PROJECT_ID)
    .digest("hex")
    .slice(0, 16);
  const count = (suffix: string): number => {
    const row = inspection.prepare(
      `SELECT COUNT(*) AS count FROM do_${prefix}_${suffix}`
    ).get() as { count: number };
    return row.count;
  };
  assert.deepEqual({
    outputs: count("outputs"),
    declarations: count("declarations"),
    definitionUpdateClaims: count("definition_update_claims"),
    refreshClaims: count("refresh_claims"),
    revisions: count("revisions"),
    attempts: count("refresh_attempts")
  }, {
    outputs: 1,
    declarations: 1,
    definitionUpdateClaims: 1,
    refreshClaims: 1,
    revisions: 1,
    attempts: 1
  });

  await service.delete(output.id);
  assert.deepEqual({
    outputs: count("outputs"),
    declarations: count("declarations"),
    definitionUpdateClaims: count("definition_update_claims"),
    refreshClaims: count("refresh_claims"),
    revisions: count("revisions"),
    attempts: count("refresh_attempts")
  }, {
    outputs: 0,
    declarations: 0,
    definitionUpdateClaims: 0,
    refreshClaims: 0,
    revisions: 0,
    attempts: 0
  });
  await assert.rejects(
    service.delete(output.id),
    DerivedOutputNotFoundError
  );
  await assert.rejects(
    service.updateDefinition(output.id, {
      prompt: "Missing",
      contextEntries: [],
      stabilisationText: "",
      expectedDefinitionRevision: 1
    }),
    DerivedOutputNotFoundError
  );

  const redeclared = await service.declare(declaration, {
    idempotencyKey: "delete-claim"
  });
  assert.notEqual(redeclared.id, output.id);
});

test("Knowledge add and remove invalidate outputs and fence an in-flight refresh", async (t) => {
  const logger = new CapturingLogger();
  const knowledge = createEventedKnowledge(logger);
  const oldPlanningStarted = deferred<void>();
  const releaseOldPlanning = deferred<void>();
  let planningCalls = 0;
  const intelligence = {
    reasonStructured: async () => {
      planningCalls += 1;
      if (planningCalls === 1) {
        oldPlanningStarted.resolve();
        await releaseOldPlanning.promise;
      }
      return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
    }
  } as unknown as Intelligence;
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    knowledge,
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    logger
  );
  knowledge.onSourceMutation((mutation) => {
    service.recordKnowledgeSourceMutation(mutation);
  });
  const output = await service.declare({ prompt: "Question" });
  const oldRefresh = service.refresh(output.id);
  await oldPlanningStarted.promise;

  const added = await knowledge.add({
    sourceId: "source-1",
    label: "empty source",
    revision: "revision-1",
    text: ""
  });
  assert.equal(added.skipped, false);
  assert.equal((await service.get(output.id))?.freshness.state, "stale");
  const skippedAdd = await knowledge.add({
    sourceId: "source-1",
    label: "empty source",
    revision: "revision-1",
    text: ""
  });
  assert.equal(skippedAdd.skipped, true);
  assert.equal(logger.entries.filter(
    (entry) => entry.message === "derived-outputs.knowledge.invalidated"
  ).length, 1);

  releaseOldPlanning.resolve();
  const oldResult = await oldRefresh;
  assert.equal(oldResult.skipped, true);
  assert.equal(oldResult.revision, undefined);
  assert.equal(oldResult.output.headRevision, 0);
  assert.equal(oldResult.output.freshness.state, "stale");

  const newerResult = await service.refresh(output.id);
  assert.equal(newerResult.output.headRevision, 1);
  assert.equal(newerResult.output.freshness.state, "current");

  await knowledge.remove("source-1");
  const afterRemove = await service.get(output.id);
  assert.equal(afterRemove?.headRevision, 1);
  assert.equal(afterRemove?.freshness.state, "stale");
  assert.equal(logger.entries.filter(
    (entry) => entry.message === "derived-outputs.knowledge.invalidated"
  ).length, 2);
});

test("one frozen manifest scopes initial retrieval and every synthesis evidence tool", async (t) => {
  const descriptor: KnowledgeResourceDescriptor = {
    sourceId: "source-1",
    resourceId: "doc-1",
    resourceKind: "general::file::text",
    resourceRevision: 1
  };
  const contextEntries = [{ id: "doc-1", kind: "general::file::text" }];
  const manifest = makeManifest([descriptor], contextEntries);
  const region: Region = {
    sourceId: descriptor.sourceId,
    label: "general-file",
    start: 0,
    end: 4,
    text: "fact",
    relevance: 1,
    density: 1
  };
  const manifestsSeen: Array<KnowledgeScopeManifest | null | undefined> = [];
  let resolveCalls = 0;
  const knowledge = makeKnowledge(
    manifest,
    async (_query, options) => {
      manifestsSeen.push(options?.scopeManifest);
      return { regions: [region], scope: manifest, usage: ZERO_USAGE };
    },
    (entries) => {
      resolveCalls += 1;
      assert.deepEqual(entries, contextEntries);
    }
  );
  let listCalls = 0;
  let readCalls = 0;
  const resourceReader: ResourceReader = {
    describeSource: async () => descriptor,
    list: async (scope) => {
      listCalls += 1;
      assert.equal(scope, manifest);
      return scope.resources;
    },
    read: async () => {
      readCalls += 1;
      return null;
    }
  };
  let listed: unknown;
  let deniedRead: unknown;
  let listedEvidence: unknown;
  const intelligence = {
    reasonStructured: async () => ({
      structured: { queries: ["initial"] },
      usage: ZERO_USAGE
    }),
    reasonWithToolsStructured: async (
      _signal: unknown,
      _request: unknown,
      tools: { execute(call: unknown): Promise<unknown> }
    ) => {
      listed = await tools.execute({
        id: "tool-list",
        name: "list_resources",
        arguments: {}
      });
      deniedRead = await tools.execute({
        id: "tool-read",
        name: "read",
        arguments: {
          resourceId: "outside",
          resourceKind: "general::file::text",
          startLine: 1,
          endLine: 2
        }
      });
      await tools.execute({
        id: "tool-retrieve",
        name: "retrieve",
        arguments: { query: "follow-up" }
      });
      listedEvidence = await tools.execute({
        id: "tool-evidence",
        name: "list_evidence",
        arguments: {}
      });
      return {
        structured: {
          status: "ok",
          text: "answer",
          evidence: [{
            resourceId: descriptor.resourceId,
            resourceKind: descriptor.resourceKind,
            resourceRevision: descriptor.resourceRevision,
            sourceId: descriptor.sourceId,
            span: { kind: "characters", start: 0, end: 4 },
            relevanceRank: 1,
            contribution: "Provided the answer fact."
          }]
        },
        messages: [],
        toolResults: [],
        rounds: 1,
        calls: 4,
        usage: ZERO_USAGE
      };
    }
  } as unknown as Intelligence;
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    knowledge,
    intelligence,
    resourceReader,
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await service.declare({
    prompt: "Scoped question",
    contextEntries
  });
  const result = await service.refresh(output.id);

  assert.equal(resolveCalls, 1);
  assert.equal(manifestsSeen.length, 2);
  assert.ok(manifestsSeen.every((seen) => seen === manifest));
  assert.equal(listCalls, 1);
  assert.equal(readCalls, 0, "an out-of-scope read is rejected before the reader");
  assert.equal((listed as { ok: boolean }).ok, true);
  assert.equal((deniedRead as { ok: boolean }).ok, false);
  assert.equal((listedEvidence as { ok: boolean }).ok, true);
  assert.deepEqual(result.revision?.evidence[0]?.span, {
    kind: "characters",
    start: 0,
    end: 4
  });
});

test("the runtime registry maps General Files and every Connector item into a read boundary", async () => {
  const logger = new CapturingLogger();
  const directory = mkdtempSync(join(tmpdir(), "icarus-derived-reader-"));
  const contexts = {
    resolve: async (entries: ContextEntry[]) => entries
  } as unknown as ContextManager;
  const knowledge = {
    add: async (item: { sourceId: string }) => ({
      sourceId: item.sourceId,
      skipped: false,
      windowsAdded: 1,
      windowsReused: 0,
      usage: ZERO_USAGE
    }),
    remove: async () => undefined
  } as unknown as Knowledge;
  const generalFiles = createGeneralFileService(
    new SQLiteGeneralFileStore("test-project", join(directory, "files.db")),
    knowledge,
    logger
  );
  const uploaded = await generalFiles.upload({
    fileName: "known.txt",
    content: "known resource content"
  });

  const fileSourceId = "connector:file-source";
  const directorySourceIds = ["connector:directory-a", "connector:directory-b"];
  const timestamp = "2026-08-01T00:00:00.000Z";
  const entries: ConnectorEntry[] = [{
    id: "connector-file",
    kind: "connector::file::text",
    providerKind: "test",
    locator: "/file",
    label: "file",
    revision: 3,
    syncConfig: null,
    syncing: false,
    knowledgeSourceIds: [fileSourceId],
    createdAt: timestamp,
    updatedAt: timestamp
  }, {
    id: "connector-directory",
    kind: "connector::directory::text",
    providerKind: "test",
    locator: "/directory",
    label: "directory",
    revision: 4,
    syncConfig: null,
    syncing: false,
    knowledgeSourceIds: directorySourceIds,
    createdAt: timestamp,
    updatedAt: timestamp
  }];
  const items: ConnectorItemEntry[] = directorySourceIds.map((sourceId, index) => ({
    itemKey: `item-${index}`,
    name: `item-${index}.txt`,
    extension: "txt",
    byteSize: 20,
    revisionToken: `revision-${index}`,
    lastModifiedAt: timestamp,
    status: "prose",
    knowledgeSourceId: sourceId
  }));
  const makeReader = (text: string) => ({
    byteSize: Buffer.byteLength(text),
    readLines: async (startLine: number, endLine: number) =>
      text.split("\n").slice(startLine - 1, endLine)
  });
  const connector = {
    list: () => entries,
    get: (id: string) => entries.find((entry) => entry.id === id)!,
    getReader: async () => makeReader("connector file content"),
    getDirectoryReader: () => ({
      listItems: () => items,
      getItemReader: async (itemKey: string) =>
        makeReader(`content for ${itemKey}`)
    })
  } as unknown as ConnectorService;

  const registry = createResourceReader(contexts, logger);
  registry.registerGeneralFiles(generalFiles);
  registry.registerConnector(connector);
  const requested: ContextEntry[] = [{
    id: uploaded.file.id,
    kind: uploaded.file.kind
  }, ...entries.map((entry) => ({ id: entry.id, kind: entry.kind }))];
  const resolved = await registry.resolve(requested);
  assert.deepEqual(
    resolved.map((entry) => entry.id),
    [
      ...directorySourceIds,
      fileSourceId,
      uploaded.file.knowledgeSourceId!
    ].sort()
  );

  const descriptors = (await Promise.all(
    resolved.map((entry) => registry.describeSource(entry.id))
  )).filter((descriptor): descriptor is KnowledgeResourceDescriptor => descriptor !== null);
  const manifest = makeManifest(descriptors, requested);
  const listed = await registry.list(manifest);
  assert.equal(listed.length, 4);

  const generalContent = await registry.read(
    uploaded.file.id,
    uploaded.file.kind,
    1,
    10,
    manifest
  );
  assert.equal(generalContent?.text, "known resource content");

  const directoryContent = await registry.read(
    directorySourceIds[0],
    "connector::directory::text",
    1,
    2,
    manifest
  );
  assert.equal(directoryContent?.text, "content for item-0");

  const generalOnly = makeManifest(
    descriptors.filter((descriptor) =>
      descriptor.sourceId === uploaded.file.knowledgeSourceId
    )
  );
  assert.equal(await registry.read(
    directorySourceIds[0],
    "connector::directory::text",
    1,
    2,
    generalOnly
  ), null);
});

test("concurrent refreshes publish one revision and leave current freshness", async (t) => {
  let planningCalls = 0;
  const planningBarrier = deferred<void>();
  const intelligence = {
    reasonStructured: async () => {
      planningCalls += 1;
      if (planningCalls === 2) planningBarrier.resolve();
      await planningBarrier.promise;
      return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
    }
  } as unknown as Intelligence;
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await service.declare({ prompt: "Question" });

  const results = await Promise.all([
    service.refresh(output.id),
    service.refresh(output.id)
  ]);
  const settled = await service.get(output.id);

  assert.equal(settled?.headRevision, 1);
  assert.equal(settled?.freshness.state, "current");
  assert.equal(results.filter((result) => result.revision).length, 1);
  assert.equal(results.filter((result) => result.skipped).length, 1);
});

test("an old-definition refresh cannot roll back a newer published definition", async (t) => {
  let planningCalls = 0;
  const oldStarted = deferred<void>();
  const releaseOld = deferred<void>();
  const intelligence = {
    reasonStructured: async () => {
      planningCalls += 1;
      if (planningCalls === 1) {
        oldStarted.resolve();
        await releaseOld.promise;
      }
      return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
    }
  } as unknown as Intelligence;
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    new CapturingLogger()
  );
  const output = await service.declare({ prompt: "Old question" });
  const oldRefresh = service.refresh(output.id);
  await oldStarted.promise;

  await service.updateDefinition(output.id, {
    prompt: "New question",
    contextEntries: [],
    stabilisationText: "",
    expectedDefinitionRevision: 1
  });
  const newerRefresh = await service.refresh(output.id);
  assert.equal(newerRefresh.revision?.definitionRevision, 2);
  releaseOld.resolve();
  const oldResult = await oldRefresh;
  const settled = await service.get(output.id);

  assert.equal(oldResult.skipped, true);
  assert.equal(settled?.definition.definitionRevision, 2);
  assert.equal(settled?.headRevision, 1);
  assert.equal(settled?.freshness.state, "current");
  assert.equal((await service.getRevision(output.id, 1))?.definitionRevision, 2);
});

test("a late failing attempt cannot overwrite a newer successful head", async (t) => {
  let planningCalls = 0;
  const oldStarted = deferred<void>();
  const releaseOld = deferred<void>();
  const intelligence = {
    reasonStructured: async () => {
      planningCalls += 1;
      if (planningCalls === 1) {
        oldStarted.resolve();
        await releaseOld.promise;
        throw new Error("provider included a sensitive response body");
      }
      return { structured: { queries: ["answer"] }, usage: ZERO_USAGE };
    }
  } as unknown as Intelligence;
  const logger = new CapturingLogger();
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    noEvidenceKnowledge(),
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    logger
  );
  const output = await service.declare({ prompt: "Question" });
  const oldRefresh = service.refresh(output.id);
  await oldStarted.promise;
  const newer = await service.refresh(output.id);
  assert.equal(newer.output.freshness.state, "current");
  releaseOld.resolve();
  const oldResult = await oldRefresh;
  const settled = await service.get(output.id);

  assert.equal(oldResult.skipped, true);
  assert.equal(settled?.headRevision, 1);
  assert.equal(settled?.freshness.state, "current");
  assert.doesNotMatch(JSON.stringify(logger.entries), /sensitive response body/);
});

test("untrusted evidence spans fail safely after all pipeline usage is counted", async (t) => {
  const descriptor: KnowledgeResourceDescriptor = {
    sourceId: "source-1",
    resourceId: "doc-1",
    resourceKind: "general::file::text",
    resourceRevision: 1
  };
  const manifest = makeManifest([descriptor]);
  const usage = (totalTokens: number): Usage => ({
    promptTokens: totalTokens,
    completionTokens: 0,
    totalTokens,
    reasoningTokens: 0
  });
  const knowledge = makeKnowledge(manifest, async () => ({
    regions: [{
      sourceId: descriptor.sourceId,
      label: "general-file",
      start: 0,
      end: 4,
      text: "fact",
      relevance: 1,
      density: 1
    }],
    scope: manifest,
    usage: usage(2)
  }));
  const intelligence = {
    reasonStructured: async () => ({
      structured: { queries: ["answer"] },
      usage: usage(1)
    }),
    reasonWithToolsStructured: async () => ({
      structured: {
        status: "ok",
        text: "unsupported answer",
        evidence: [{
          resourceId: descriptor.resourceId,
          resourceKind: descriptor.resourceKind,
          resourceRevision: descriptor.resourceRevision,
          sourceId: descriptor.sourceId,
          span: { kind: "characters", start: 0, end: 99 },
          relevanceRank: 1,
          contribution: "Claimed an unobserved span."
        }]
      },
      messages: [],
      toolResults: [],
      rounds: 0,
      calls: 0,
      usage: usage(3)
    })
  } as unknown as Intelligence;
  const logger = new CapturingLogger();
  const store = createStore();
  t.after(() => store.close());
  const service = createDerivedOutputService(
    store,
    knowledge,
    intelligence,
    makeResourceReader(),
    { maxPlanQueries: 8, maxToolRounds: 8 },
    logger
  );
  const output = await service.declare({ prompt: "Question" });
  const result = await service.refresh(output.id);

  assert.equal(result.output.headRevision, 0);
  assert.equal(result.output.freshness.state, "failed");
  assert.equal(result.output.freshness.diagnostic?.message, "Refresh failed during synthesise.");
  const failure = logger.entries.find(
    (entry) => entry.message === "derived-outputs.refresh.failed"
  );
  assert.equal((failure?.data as { totalTokens?: number }).totalTokens, 6);
  assert.doesNotMatch(JSON.stringify(logger.entries), /outside the frozen scope|did not originate/);
});
