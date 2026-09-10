import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const state = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  const counters = new Map<string, number>();
  const calls = {
    queries: 0,
    queryOverride: undefined as ((signal?: AbortSignal) => Promise<never>) | undefined,
    nativeReads: 0,
    requestScopes: 0,
    globalModels: 0,
    logs: [] as unknown[],
    failAfterNodes: Infinity,
    nodes: 0
  };
  const rows = (table: string): Row[] => tables.get(table) ?? [];
  const store = {
    create: (table: string, fields: unknown): string => {
      if (table === "semanticIndexNodes") {
        calls.nodes += 1;
        if (calls.nodes > calls.failAfterNodes) throw new Error("simulated node write failure");
      }
      const next = (counters.get(table) ?? 0) + 1;
      counters.set(table, next);
      const id = `${table}:${next}`;
      tables.set(table, [...rows(table), { ...(fields as Row), _id: id, _creationTime: next }]);
      return id;
    },
    createMany: (table: string, fields: readonly unknown[]): readonly string[] =>
      fields.map((entry) => store.create(table, entry)),
    read: (path: string) => {
      const [table] = path.split(".");
      return { table, kind: "table", rows: rows(table) };
    },
    update: (path: string, value: unknown) => {
      const [table, id, ...fields] = path.split(".");
      tables.set(
        table,
        rows(table).map((row) => {
          if (row._id !== id) return row;
          if (fields.length !== 1) throw new Error("fake only updates one field");
          return { ...row, [fields[0]]: value };
        })
      );
    },
    remove: (path: string) => {
      const [table, id] = path.split(".");
      tables.set(table, rows(table).filter((row) => row._id !== id));
    },
    removeRows: (table: string, ids: readonly string[]) => {
      const removed = new Set(ids);
      tables.set(table, rows(table).filter((row) => !removed.has(row._id)));
    },
    transaction: <T>(work: (unit: StoreUnitOfWork) => T): T => {
      const beforeTables = structuredClone([...tables.entries()]);
      const beforeCounters = structuredClone([...counters.entries()]);
      try {
        return work(store as unknown as StoreUnitOfWork);
      } catch (error) {
        tables.clear();
        for (const [table, held] of beforeTables) tables.set(table, held);
        counters.clear();
        for (const [table, count] of beforeCounters) counters.set(table, count);
        throw error;
      }
    }
  };
  const configuration = {
    get: (key: string): unknown =>
      ({
        "semanticOverlay.index.branchFactor": 3,
        "semanticOverlay.index.leafSize": 2,
        "semanticOverlay.index.maxIterations": 16,
        "semanticOverlay.index.convergenceTolerance": 0.000001,
        "semanticOverlay.index.candidateMultiplier": 2
      })[key]
  };
  const model = {
    store,
    configuration,
    embedding: {
      space: { provider: "jina", model: "jina-embeddings-v4", dimensions: 2 },
      query: async (_text: string, signal?: AbortSignal) => {
        calls.queries += 1;
        if (calls.queryOverride !== undefined) return await calls.queryOverride(signal);
        return {
          value: [1, 0],
          usage: {
            operation: "queryVector",
            api: "jina",
            model: "jina-embeddings-v4",
            requestCount: 1,
            inputItems: 1
          }
        };
      }
    },
    externalFileStorage: {
      read: async () => {
        calls.nativeReads += 1;
        throw new Error("enqueue must not read native material content");
      }
    },
    observability: { logger: { info: (...values: unknown[]) => calls.logs.push(values) } }
  };
  return { tables, counters, calls, model };
});

vi.mock("$runtime/server/scope.server", () => ({
  requireScope: async () => {
    state.calls.requestScopes += 1;
    return { projectId: "projects:1", userId: "users:1", username: "You" };
  }
}));
vi.mock("$runtime/server/start.server", () => ({
  serverModel: () => {
    state.calls.globalModels += 1;
    return state.model;
  }
}));

const { rebuildSemanticIndex } = await import(
  "$capabilities/semantic-overlay/api/rebuild-semantic-index/rebuild-semantic-index"
);
const { querySemanticOverlay } = await import(
  "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay"
);
const { querySemanticOverlayForModel } = await import(
  "$capabilities/semantic-overlay/api/shared/query-text-for-model"
);
const { querySemanticMaterialsForModel } = await import(
  "$capabilities/semantic-overlay/api/shared/query-materials-for-model"
);
const { enqueueSemanticSync } = await import(
  "$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync"
);
const { enqueueSemanticSyncForModel } = await import(
  "$capabilities/semantic-overlay/api/shared/enqueue-for-model"
);
const { readSemanticStatus } = await import(
  "$capabilities/semantic-overlay/api/read-semantic-status/read-semantic-status"
);

const seed = (table: string, row: Row): void => {
  state.tables.set(table, [...(state.tables.get(table) ?? []), row]);
  const sequence = Number(row._id.split(":").at(-1));
  state.counters.set(table, Math.max(state.counters.get(table) ?? 0, sequence));
};

const baseRows = (): void => {
  seed("semanticOverlays", {
    _id: "semanticOverlays:1",
    _creationTime: 1,
    projectId: "projects:1",
    generation: 4,
    embedding: { provider: "jina", model: "jina-embeddings-v4", dimensions: 2 },
    updatedAt: 1
  });
  const vectors = [[1, 0], [0.98, 0.1], [0, 1], [0.1, 0.98], [-1, 0], [-0.98, -0.1]];
  vectors.forEach((vector, index) => {
    const number = index + 1;
    const externalHash = String(number).repeat(64);
    seed("semanticSources", {
      _id: `semanticSources:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      ref: number <= 2
        ? { kind: "document", id: `documents:${number}` }
        : { kind: "externalFile::text", id: `externalFiles:${number}` },
      revision: 1,
      ...(number <= 2 ? {} : { contentHash: externalHash }),
      encoding: "utf-16",
      updatedAt: 1
    });
    const text = `object ${number}`;
    seed("semanticObjects", {
      _id: `semanticObjects:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      lane: "text",
      semanticSourceId: `semanticSources:${number}`,
      span: { from: 0, to: text.length, text },
      vector
    });
  });
  for (const number of [1, 2]) {
    seed("documents", {
      _id: `documents:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      title: `Document ${number}`,
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      updatedAt: 1
    });
    seed("documentSnapshots", {
      _id: `documentSnapshots:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      resourceId: `documents:${number}`,
      revision: 1,
      role: "leader",
      part: 0,
      body: { rows: [] },
      at: 1
    });
  }
  for (const number of [3, 4, 5, 6]) {
    seed("externalFiles", {
      _id: `externalFiles:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      name: `Text file ${number}`,
      originalName: `Text file ${number}`,
      relativePath: `Text file ${number}`,
      mediaType: "text/plain",
      subkind: "text",
      storageId: `_storage:${String(number).repeat(64)}`,
      hash: String(number).repeat(64),
      size: 0,
      origin: { kind: "upload" },
      createdBy: { kind: "system" },
      updatedBy: { kind: "system" },
      revision: 1,
      updatedAt: 1
    });
  }
};

beforeEach(() => {
  state.tables.clear();
  state.counters.clear();
  state.calls.queries = 0;
  state.calls.queryOverride = undefined;
  state.calls.nativeReads = 0;
  state.calls.requestScopes = 0;
  state.calls.globalModels = 0;
  state.calls.logs.length = 0;
  state.calls.failAfterNodes = Infinity;
  state.calls.nodes = 0;
  baseRows();
});

test("model-scoped enqueue needs no ambient request or global model", async () => {
  const ref = { kind: "externalFile::text" as const, id: "externalFiles:3" as never };

  const result = await enqueueSemanticSyncForModel(
    state.model as never,
    "projects:1" as never,
    ref
  );

  assert.deepEqual(result, { ref, revision: 1 });
  assert.equal(state.calls.requestScopes, 0);
  assert.equal(state.calls.globalModels, 0);
  assert.equal(await enqueueSemanticSyncForModel(
    state.model as never,
    "projects:foreign" as never,
    ref
  ), null, "a foreign project cannot enqueue the resource");
  await assert.rejects(
    () => enqueueSemanticSyncForModel(
      state.model as never,
      "projects:1" as never,
      { ...ref, legacyKind: "externalFile" } as never
    ),
    /exact current kind/
  );
});

test("model-scoped queries need no ambient request or global model", async () => {
  const textResult = await querySemanticOverlayForModel(
    state.model as never,
    "projects:1" as never,
    {
      text: "first direction",
      topK: 2,
      scope: { include: [{ select: "resources", refs: [] }], exclude: [] }
    }
  );
  const materialResult = await querySemanticMaterialsForModel(
    state.model as never,
    "projects:1" as never,
    { text: "first direction", topK: 2 }
  );

  assert.deepEqual(textResult.hits, []);
  assert.deepEqual(materialResult.hits, []);
  assert.equal(state.calls.requestScopes, 0);
  assert.equal(state.calls.globalModels, 0);
  await assert.rejects(
    () => querySemanticOverlayForModel(
      state.model as never,
      "projects:1" as never,
      { text: "first direction", topK: 2, legacyScope: null }
    ),
    /unknown field 'legacyScope'/
  );
});

test("external-file enqueue records only material work without reading native bytes", async () => {
  seed("externalFiles", {
    _id: "externalFiles:1",
    _creationTime: 1,
    projectId: "projects:1",
    name: "large.csv",
    originalName: "large.csv",
    relativePath: "large.csv",
    mediaType: "text/csv",
    subkind: "data",
    size: 8_000_000,
    storageId: `_storage:${"a".repeat(64)}`,
    hash: "a".repeat(64),
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedBy: { kind: "system" },
    revision: 1,
    updatedAt: 1
  });

  const result = await enqueueSemanticSync({
    ref: { kind: "externalFile::data", id: "externalFiles:1" }
  });

  assert.equal(result?.jobId, undefined);
  assert.equal(result?.revision, 1);
  assert.deepEqual(result?.ref, { kind: "externalFile::data", id: "externalFiles:1" });
  assert.equal(state.calls.nativeReads, 0);
  assert.deepEqual((state.tables.get("semanticSyncJobs") ?? []).length, 0);
  assert.deepEqual(
    (state.tables.get("semanticMaterialJobs") ?? []).map((row) => row.ref),
    [{ kind: "externalFile::data", id: "externalFiles:1" }]
  );
});

test("current prose rows enter only the exact-text lane", async () => {
  seed("externalFiles", {
    _id: "externalFiles:notes",
    _creationTime: 2,
    projectId: "projects:1",
    name: "notes.md",
    originalName: "notes.md",
    relativePath: "notes.md",
    mediaType: "text/markdown",
    subkind: "text",
    storageId: `_storage:${"b".repeat(64)}`,
    hash: "b".repeat(64),
    size: 24,
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedBy: { kind: "system" },
    revision: 1,
    updatedAt: 1
  });

  const result = await enqueueSemanticSync({
    ref: { kind: "externalFile::text", id: "externalFiles:notes" }
  });

  assert.ok(result?.jobId !== undefined);
  assert.equal(result?.materialJobId, undefined);
  assert.deepEqual(result?.ref, { kind: "externalFile::text", id: "externalFiles:notes" });
  assert.equal(state.calls.nativeReads, 0);
  assert.deepEqual(
    (state.tables.get("semanticSyncJobs") ?? []).map((row) => row.ref),
    [{ kind: "externalFile::text", id: "externalFiles:notes" }]
  );

  await assert.rejects(
    () => enqueueSemanticSync({ ref: { kind: "externalFile", id: "externalFiles:notes" } }),
    /exact current kind/
  );
  assert.equal(await enqueueSemanticSync({
    ref: { kind: "externalFile::data", id: "externalFiles:notes" }
  }), null, "a mismatched concrete kind is not repaired from the row");
  assert.equal((state.tables.get("semanticMaterialJobs") ?? []).length, 0);
});

const seedCurrentCodeFile = (): void => {
  const hash = "d".repeat(64);
  seed("externalFiles", {
    _id: "externalFiles:10",
    _creationTime: 10,
    projectId: "projects:1",
    name: "pricing.ts",
    originalName: "pricing.ts",
    relativePath: "pricing.ts",
    mediaType: "text/typescript",
    subkind: "code",
    storageId: `_storage:${hash}`,
    hash,
    size: 120,
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedBy: { kind: "system" },
    revision: 1,
    updatedAt: 10
  });
  seed("semanticSources", {
    _id: "semanticSources:10",
    _creationTime: 11,
    projectId: "projects:1",
    ref: { kind: "externalFile::text", id: "externalFiles:10" },
    revision: 0,
    contentHash: hash,
    encoding: "utf-16",
    updatedAt: 11
  });
  seed("semanticObjects", {
    _id: "semanticObjects:10",
    _creationTime: 12,
    projectId: "projects:1",
    lane: "text",
    semanticSourceId: "semanticSources:10",
    span: { from: 0, to: 7, text: "pricing" },
    vector: [1, 0]
  });
  seed("semanticMaterials", {
    _id: "semanticMaterials:10",
    _creationTime: 13,
    projectId: "projects:1",
    identityKey: "code",
    kind: "code",
    name: "pricing.ts",
    source: {
      kind: "externalFile",
      ref: { kind: "externalFile::code", id: "externalFiles:10" },
      fileId: "externalFiles:10",
      hash,
      mediaType: "text/typescript",
      subkind: "code"
    },
    profile: {
      kind: "code",
      language: "typescript",
      lines: 8,
      imports: [],
      exports: ["price"],
      symbols: [],
      parser: "bounded-regex",
      truncated: false,
      warnings: []
    },
    profileHash: "profile",
    contextHash: "context",
    revisionKey: `hash:${hash}`,
    descriptor: {
      summary: "Calculates plan pricing.",
      entities: ["plan"],
      measures: ["price"],
      dimensions: [],
      themes: ["pricing"],
      uncertainty: [],
      coverage: { mode: "complete", description: "Complete bounded source" },
      model: "test-model",
      promptVersion: "material-v1",
      inputHash: "descriptor",
      generatedAt: 13
    },
    state: "ready",
    updatedAt: 13
  });
  seed("semanticObjects", {
    _id: "semanticObjects:11",
    _creationTime: 14,
    projectId: "projects:1",
    lane: "material",
    semanticMaterialId: "semanticMaterials:10",
    facet: "profile",
    facetText: "TypeScript pricing utility",
    inputHash: "facet",
    vector: [1, 0]
  });
};

test("semantic status projects code only through the material lane", async () => {
  seedCurrentCodeFile();

  const status = await readSemanticStatus({
    ref: { kind: "externalFile::code", id: "externalFiles:10" }
  });

  assert.equal(status?.exact.state, "unsupported");
  assert.equal(status?.exact.objectCount, 0);
  assert.equal(status?.material.state, "current");
  assert.equal(status?.material.kind, "code");
  assert.equal(status?.material.descriptor?.summary, "Calculates plan pricing.");
  assert.equal(status?.material.descriptor?.model, "test-model");
  assert.ok(status?.material.profile?.facts.some((fact) => fact.toLowerCase().includes("typescript")));

  assert.equal(await readSemanticStatus({
    ref: { kind: "externalFile::data", id: "externalFiles:10" }
  }), null, "status does not repair a wrong concrete subkind");
});

test("semantic status admits only an exact current nominal reference", async () => {
  await assert.rejects(
    () => readSemanticStatus({ ref: { kind: "externalFile", id: "externalFiles:10" } }),
    /exact current kind/
  );
  await assert.rejects(
    () => readSemanticStatus({ ref: { kind: "externalFile::code", id: "documents:10" } }),
    /matching row id/
  );
  await assert.rejects(
    () => readSemanticStatus({
      ref: { kind: "externalFile::code", id: "externalFiles:10" },
      compatibilityKind: "externalFile"
    }),
    /exact current data fields/
  );
});

test("rebuild publishes a complete replacement before retiring the old tree", async () => {
  seed("semanticIndexes", {
    _id: "semanticIndexes:1",
    _creationTime: 1,
    projectId: "projects:1",
    semanticOverlayId: "semanticOverlays:1",
    method: "recursiveClustering",
    lane: "text",
    rootNodeIds: ["semanticIndexNodes:1"],
    configuration: {
      branchFactor: 3,
      leafSize: 2,
      maxIterations: 16,
      convergenceTolerance: 0.000001,
      candidateMultiplier: 2
    },
    updatedAt: 1
  });
  seed("semanticIndexNodes", {
    _id: "semanticIndexNodes:1",
    _creationTime: 1,
    projectId: "projects:1",
    indexId: "semanticIndexes:1",
    centroidVector: [1, 0],
    children: { kind: "objects", ids: ["semanticObjects:1"] }
  });

  const result = await rebuildSemanticIndex({});

  assert.equal(result.objectCount, 6);
  assert.ok(result.nodeCount >= result.rootCount);
  const indexes = state.tables.get("semanticIndexes") ?? [];
  assert.equal(indexes.length, 1);
  assert.equal(indexes[0]._id, result.indexId);
  assert.ok((indexes[0].rootNodeIds as string[]).length > 0);
  const nodes = state.tables.get("semanticIndexNodes") ?? [];
  assert.equal(nodes.length, result.nodeCount);
  assert.equal(nodes.every((node) => node.indexId === result.indexId), true);
});

test("a failed replacement is cleaned up and leaves the prior tree", async () => {
  seed("semanticIndexes", {
    _id: "semanticIndexes:1",
    _creationTime: 1,
    projectId: "projects:1",
    semanticOverlayId: "semanticOverlays:1",
    method: "recursiveClustering",
    lane: "text",
    rootNodeIds: ["semanticIndexNodes:1"],
    configuration: {
      branchFactor: 3,
      leafSize: 2,
      maxIterations: 16,
      convergenceTolerance: 0.000001,
      candidateMultiplier: 2
    },
    updatedAt: 1
  });
  seed("semanticIndexNodes", {
    _id: "semanticIndexNodes:1",
    _creationTime: 1,
    projectId: "projects:1",
    indexId: "semanticIndexes:1",
    centroidVector: [1, 0],
    children: { kind: "objects", ids: ["semanticObjects:1"] }
  });
  state.calls.failAfterNodes = 1;

  await assert.rejects(() => rebuildSemanticIndex({}), /simulated node write failure/);

  assert.deepEqual(
    (state.tables.get("semanticIndexes") ?? []).map((row) => row._id),
    ["semanticIndexes:1"]
  );
  assert.deepEqual(
    (state.tables.get("semanticIndexNodes") ?? []).map((row) => row._id),
    ["semanticIndexNodes:1"]
  );
});

test("query uses the built tree and returns provider usage with diagnostics", async () => {
  await rebuildSemanticIndex({});
  seed("semanticIndexes", {
    _id: "semanticIndexes:2",
    _creationTime: 999,
    projectId: "projects:1",
    semanticOverlayId: "semanticOverlays:1",
    method: "recursiveClustering",
    lane: "text",
    rootNodeIds: [],
    configuration: {
      branchFactor: 3,
      leafSize: 2,
      maxIterations: 16,
      convergenceTolerance: 0.000001,
      candidateMultiplier: 2
    },
    updatedAt: 999
  });

  const result = await querySemanticOverlay({ text: "first direction", topK: 2 });

  assert.equal(result.overlayGeneration, 4);
  assert.equal(result.hits[0].semanticObjectIds[0], "semanticObjects:1");
  assert.equal(result.hits.length, 2);
  assert.equal(result.usage[0].operation, "queryVector");
  assert.equal(result.diagnostics.eligibleObjects, 6);
  assert.equal(state.calls.queries, 1);
});

test("query cancellation reaches a blocked embedding request", async () => {
  await rebuildSemanticIndex({});
  let entered!: () => void;
  const embedding = new Promise<void>((resolve) => {
    entered = resolve;
  });
  state.calls.queryOverride = async (signal) => {
    assert.notEqual(signal, undefined);
    entered();
    await new Promise<never>((_resolve, reject) => {
      signal!.addEventListener("abort", () => reject(signal!.reason), { once: true });
    });
    throw new Error("unreachable");
  };
  const controller = new AbortController();
  const pending = querySemanticOverlay(
    { text: "interrupt this retrieval", topK: 2 },
    controller.signal
  );
  await embedding;

  controller.abort();

  await assert.rejects(pending, (error: Error) => error.name === "AbortError");
});

test("resource scope filters before traversal and an empty scope includes all", async () => {
  await rebuildSemanticIndex({});

  const selected = await querySemanticOverlay({
    text: "first direction",
    topK: 5,
    scope: {
      include: [{ select: "resources", refs: [{ kind: "externalFile::text", id: "externalFiles:4" }] }],
      exclude: []
    }
  });
  assert.deepEqual(selected.hits[0].semanticObjectIds, ["semanticObjects:4"]);
  assert.equal(selected.diagnostics.eligibleObjects, 1);

  const all = await querySemanticOverlay({
    text: "first direction",
    topK: 1,
    scope: { include: [], exclude: [] }
  });
  assert.equal(all.diagnostics.eligibleObjects, 6);

  const before = state.calls.queries;
  const none = await querySemanticOverlay({
    text: "first direction",
    topK: 1,
    scope: { include: [], exclude: [{ select: "project" }] }
  });
  assert.deepEqual(none.hits, []);
  assert.deepEqual(none.usage, []);
  assert.equal(state.calls.queries, before);
});

test("a caller cannot resolve an unnamed private Resource Set as a reusable scope", async () => {
  await rebuildSemanticIndex({});
  seed("resourceSets", {
    _id: "resourceSets:private",
    _creationTime: 1,
    projectId: "projects:1",
    boundTo: {
      kind: "resource",
      ref: { kind: "externalFile::text", id: "externalFiles:4" },
      hole: "evidence"
    },
    set: {
      include: [{ select: "resources", refs: [{ kind: "externalFile::text", id: "externalFiles:4" }] }],
      exclude: []
    },
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: 1
  });
  const before = state.calls.queries;

  await assert.rejects(
    () => querySemanticOverlay({
      text: "first direction",
      topK: 2,
      scope: {
        include: [{ select: "set", setId: "resourceSets:private" }],
        exclude: []
      }
    }),
    /does not exist/
  );
  assert.equal(state.calls.queries, before);
});

test("text query fails closed on duplicate and malformed named Resource Set rows", async () => {
  await rebuildSemanticIndex({});
  const reusable = {
    _id: "resourceSets:evidence",
    _creationTime: 1,
    projectId: "projects:1",
    name: "Evidence",
    set: {
      include: [{ select: "resources", refs: [{ kind: "externalFile::text", id: "externalFiles:4" }] }],
      exclude: []
    },
    createdBy: { kind: "system" },
    revision: 1,
    updatedAt: 1
  } satisfies Row;
  const scopedQuery = () => querySemanticOverlay({
    text: "first direction",
    topK: 2,
    scope: {
      include: [{ select: "set", setId: "resourceSets:evidence" }],
      exclude: []
    }
  });
  state.tables.set("resourceSets", [reusable]);
  const valid = await scopedQuery();
  assert.deepEqual(valid.hits[0]?.semanticObjectIds, ["semanticObjects:4"]);
  const before = state.calls.queries;

  state.tables.set("resourceSets", [
    reusable,
    { ...reusable, projectId: "projects:elsewhere", name: "Duplicate" }
  ]);
  await assert.rejects(scopedQuery, /repeats row id/);

  state.tables.set("resourceSets", [
    { ...reusable, set: { include: "everything", exclude: [] } }
  ]);
  await assert.rejects(scopedQuery, /non-current field values/);
  assert.equal(state.calls.queries, before);
});

test("query excludes an old text source as soon as its document leader advances", async () => {
  await rebuildSemanticIndex({});
  const firstLeader = (state.tables.get("documentSnapshots") ?? []).find(
    (row) => row.resourceId === "documents:1"
  );
  if (firstLeader === undefined) throw new Error("missing document leader fixture");
  firstLeader.revision = 2;

  const result = await querySemanticOverlay({ text: "first direction", topK: 2 });

  assert.equal(result.hits.some((hit) => hit.semanticObjectIds.some((id) => id === "semanticObjects:1")), false);
  assert.equal(result.diagnostics.eligibleObjects, 5);
});

test("query validation rejects abusive topK before calling Jina", async () => {
  await assert.rejects(
    () => querySemanticOverlay({ text: "query", topK: 101 }),
    /1 through 100/
  );
  assert.equal(state.calls.queries, 0);
});
