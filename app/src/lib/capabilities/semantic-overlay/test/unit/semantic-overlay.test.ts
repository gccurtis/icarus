import assert from "node:assert/strict";
import { beforeEach, test, vi } from "vitest";

type Row = Record<string, unknown> & { _id: string; _creationTime: number };

const state = vi.hoisted(() => {
  const tables = new Map<string, Row[]>();
  const counters = new Map<string, number>();
  const calls = { queries: 0, logs: [] as unknown[], failAfterNodes: Infinity, nodes: 0 };
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
};

beforeEach(() => {
  state.tables.clear();
  state.counters.clear();
  state.calls.queries = 0;
  state.calls.logs.length = 0;
  state.calls.failAfterNodes = Infinity;
  state.calls.nodes = 0;
  baseRows();
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

test("query validation rejects abusive topK before calling Jina", async () => {
  await assert.rejects(
    () => querySemanticOverlay({ text: "query", topK: 101 }),
    /1 through 100/
  );
  assert.equal(state.calls.queries, 0);
});
