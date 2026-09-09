import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";
import type { StoreUnitOfWork } from "$model/server/store/index.server";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const state = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  const counters = new Map<string, number>();
  const calls = {
    queries: 0,
    nativeReads: 0,
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
      query: async () => {
        calls.queries += 1;
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
    materialContent: {
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
  requireScope: async () => ({ projectId: "projects:1", userId: "users:1", username: "You" })
}));
vi.mock("$runtime/server/start.server", () => ({ serverModel: () => state.model }));

const { rebuildSemanticIndex } = await import(
  "$capabilities/semantic-overlay/api/rebuild-semantic-index/rebuild-semantic-index"
);
const { querySemanticOverlay } = await import(
  "$capabilities/semantic-overlay/api/query-semantic-overlay/query-semantic-overlay"
);
const { enqueueSemanticSync } = await import(
  "$capabilities/semantic-overlay/api/enqueue-semantic-sync/enqueue-semantic-sync"
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
    seed("semanticSources", {
      _id: `semanticSources:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      ref: { kind: number <= 2 ? "document" : "externalFile", id: `resource:${number}` },
      revision: 1,
      encoding: "utf-16",
      updatedAt: 1
    });
    const text = `object ${number}`;
    seed("semanticObjects", {
      _id: `semanticObjects:${number}`,
      _creationTime: number,
      projectId: "projects:1",
      semanticSourceId: `semanticSources:${number}`,
      span: { from: 0, to: text.length, text },
      vector
    });
  });
  for (const number of [1, 2]) {
    seed("documents", {
      _id: `resource:${number}`,
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
      resourceId: `resource:${number}`,
      revision: 1,
      role: "leader",
      part: 0,
      body: { rows: [] },
      at: 1
    });
  }
};

beforeEach(() => {
  state.tables.clear();
  state.counters.clear();
  state.calls.queries = 0;
  state.calls.nativeReads = 0;
  state.calls.logs.length = 0;
  state.calls.failAfterNodes = Infinity;
  state.calls.nodes = 0;
  baseRows();
});

test("external-file enqueue records only material work without reading native bytes", async () => {
  seed("externalFiles", {
    _id: "externalFiles:1",
    _creationTime: 1,
    projectId: "projects:1",
    name: "large.csv",
    mediaType: "text/csv",
    subkind: "data",
    size: 8_000_000,
    storageId: "storage:1",
    hash: "a".repeat(64),
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedAt: 1
  });

  const result = await enqueueSemanticSync({
    ref: { kind: "externalFile::data", id: "externalFiles:1" }
  });

  assert.equal(result?.jobId, undefined);
  assert.equal(result?.revision, 0);
  assert.deepEqual(result?.ref, { kind: "externalFile::data", id: "externalFiles:1" });
  assert.equal(state.calls.nativeReads, 0);
  assert.deepEqual((state.tables.get("semanticSyncJobs") ?? []).length, 0);
  assert.deepEqual(
    (state.tables.get("semanticMaterialJobs") ?? []).map((row) => row.ref),
    [{ kind: "externalFile::data", id: "externalFiles:1" }]
  );
});

test("UTF-8 external-file enqueue schedules both exact text and material work without reading bytes", async () => {
  seed("externalFiles", {
    _id: "externalFiles:notes",
    _creationTime: 2,
    projectId: "projects:1",
    name: "notes.md",
    mediaType: "text/markdown",
    subkind: "text",
    storageId: "storage:notes",
    hash: "b".repeat(64),
    origin: { kind: "upload" },
    createdBy: { kind: "system" },
    updatedAt: 1
  });

  const result = await enqueueSemanticSync({
    ref: { kind: "externalFile", id: "externalFiles:notes" }
  });

  assert.deepEqual(result?.ref, { kind: "externalFile::text", id: "externalFiles:notes" });
  assert.ok(result?.jobId !== undefined);
  assert.ok(result?.materialJobId !== undefined);
  assert.equal(state.calls.nativeReads, 0);
  assert.deepEqual(
    (state.tables.get("semanticSyncJobs") ?? []).map((row) => row.ref),
    [{ kind: "externalFile::text", id: "externalFiles:notes" }]
  );
});

test("rebuild publishes a complete replacement before retiring the old tree", async () => {
  seed("semanticIndexes", {
    _id: "semanticIndexes:1",
    _creationTime: 1,
    projectId: "projects:1",
    semanticOverlayId: "semanticOverlays:1",
    method: "recursiveClustering",
    rootNodeIds: ["semanticIndexNodes:1"],
    configuration: {},
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
    rootNodeIds: ["semanticIndexNodes:1"],
    configuration: {},
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
    rootNodeIds: [],
    configuration: {},
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

test("resource scope filters before traversal and an empty scope includes all", async () => {
  await rebuildSemanticIndex({});

  const selected = await querySemanticOverlay({
    text: "first direction",
    topK: 5,
    scope: {
      include: [{ select: "resources", refs: [{ kind: "externalFile", id: "resource:4" }] }],
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

test("query excludes an old text source as soon as its document leader advances", async () => {
  await rebuildSemanticIndex({});
  const firstLeader = (state.tables.get("documentSnapshots") ?? []).find(
    (row) => row.resourceId === "resource:1"
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
