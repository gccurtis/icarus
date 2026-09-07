import { expect, test } from "vitest";
import { buildRecursiveIndex } from "$representation/data/behavior/semantic/recursive-index";
import {
  coalesceSemanticHits,
  searchRecursiveIndex,
  searchSemanticObjectsExhaustively
} from "$representation/data/behavior/semantic/query";
import { resourceInScope } from "$representation/data/behavior/semantic/scope";
import type { Id } from "$representation/data/types/core/id";
import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  IndexableSemanticObject,
  RecursiveIndexBuild,
  RecursiveIndexConfiguration,
  SearchableSemanticIndexNode,
  SearchableSemanticObject
} from "$representation/data/types/semantic/index";

const configuration = (
  overrides: Partial<RecursiveIndexConfiguration> = {}
): RecursiveIndexConfiguration => ({
  branchFactor: 3,
  leafSize: 2,
  maxIterations: 24,
  convergenceTolerance: 0.000001,
  candidateMultiplier: 2,
  ...overrides
});

const id = (value: number): Id<"semanticObjects"> =>
  `semanticObjects:${value}` as Id<"semanticObjects">;

const indexObject = (value: number, vector: number[]): IndexableSemanticObject => ({
  id: id(value),
  vector
});

const searchable = (
  value: number,
  vector: number[],
  text = `object ${value}`
): SearchableSemanticObject => ({
  id: id(value),
  vector,
  source: {
    ref: { kind: "document", id: `documents:${value}` },
    revision: 1,
    encoding: "utf-16"
  },
  span: { from: 0, to: text.length, text }
});

const materialize = (build: RecursiveIndexBuild): {
  roots: Id<"semanticIndexNodes">[];
  nodes: SearchableSemanticIndexNode[];
} => {
  const ids = new Map(
    build.nodes.map((node, index) => [
      node.key,
      `semanticIndexNodes:${index + 1}` as Id<"semanticIndexNodes">
    ])
  );
  return {
    roots: build.rootKeys.map((key) => ids.get(key)!),
    nodes: build.nodes.map((node) => ({
      id: ids.get(node.key)!,
      centroidVector: node.centroidVector,
      children:
        node.children.kind === "objects"
          ? node.children
          : { kind: "nodes", ids: node.children.keys.map((key) => ids.get(key)!) }
    }))
  };
};

test("recursive spherical clustering is deterministic and covers every object once", () => {
  const objects = [
    indexObject(1, [1, 0, 0]),
    indexObject(2, [0.98, 0.02, 0]),
    indexObject(3, [0.95, -0.05, 0]),
    indexObject(4, [0, 1, 0]),
    indexObject(5, [0.02, 0.98, 0]),
    indexObject(6, [-0.04, 0.96, 0]),
    indexObject(7, [0, 0, 1]),
    indexObject(8, [0, 0.03, 0.97]),
    indexObject(9, [0, -0.02, 0.98])
  ];

  const first = buildRecursiveIndex(objects, configuration());
  const reversed = buildRecursiveIndex([...objects].reverse(), configuration());

  expect(first).toEqual(reversed);
  expect(first.rootKeys.length).toBe(3);
  const leaves = first.nodes.filter((node) => node.children.kind === "objects");
  expect(leaves.every((node) => node.children.kind === "objects" && node.children.ids.length <= 2)).toBe(true);
  expect(
    leaves.flatMap((node) => (node.children.kind === "objects" ? node.children.ids : [])).sort(),
  ).toEqual(objects.map((object) => object.id).sort());
  for (const node of first.nodes) {
    const norm = Math.sqrt(node.centroidVector.reduce((sum, value) => sum + value * value, 0));
    expect(Math.abs(norm - 1)).toBeLessThan(1e-10);
  }
});

test("recursive ancestry narrows broad neighborhoods into local sub-neighborhoods", () => {
  const build = buildRecursiveIndex(
    [
      indexObject(1, [1, 0.16]),
      indexObject(2, [1, 0.08]),
      indexObject(3, [1, -0.08]),
      indexObject(4, [1, -0.16]),
      indexObject(5, [-1, 0.16]),
      indexObject(6, [-1, 0.08]),
      indexObject(7, [-1, -0.08]),
      indexObject(8, [-1, -0.16])
    ],
    configuration({ branchFactor: 2, leafSize: 1 })
  );
  const byKey = new Map(build.nodes.map((node) => [node.key, node]));
  const descendants = (key: string): Id<"semanticObjects">[] => {
    const node = byKey.get(key);
    if (node === undefined) throw new Error(`missing test node '${key}'`);
    return node.children.kind === "objects"
      ? [...node.children.ids]
      : node.children.keys.flatMap(descendants);
  };

  const rootNeighborhoods = build.rootKeys
    .map(descendants)
    .map((ids) => ids.sort())
    .sort((left, right) => left[0].localeCompare(right[0]));
  expect(rootNeighborhoods).toEqual([
    [id(1), id(2), id(3), id(4)],
    [id(5), id(6), id(7), id(8)]
  ]);
  for (const rootKey of build.rootKeys) {
    const root = byKey.get(rootKey);
    expect(root?.children.kind).toBe("nodes");
    if (root?.children.kind !== "nodes") throw new Error("expected a neighborhood node");
    expect(root.children.keys.map(descendants).map((ids) => ids.length)).toEqual([2, 2]);
  }
});

test("empty-cluster repair makes identical vectors terminate at the leaf bound", () => {
  const build = buildRecursiveIndex(
    Array.from({ length: 7 }, (_, index) => indexObject(index + 1, [1, 0])),
    configuration({ leafSize: 1 })
  );
  const leaves = build.nodes.filter((node) => node.children.kind === "objects");
  expect(leaves.length).toBe(7);
  expect(
    leaves.every((node) => node.children.kind === "objects" && node.children.ids.length === 1),
  ).toBe(true);
});

test("index construction rejects duplicate IDs, mixed dimensions, and zero vectors", () => {
  expect(
    () => buildRecursiveIndex([indexObject(1, [1, 0]), indexObject(1, [0, 1])], configuration()),
  ).toThrow(/duplicate semantic object/);
  expect(
    () => buildRecursiveIndex([indexObject(1, [1, 0]), indexObject(2, [0, 1, 0])], configuration()),
  ).toThrow(/must have 2 dimensions/);
  expect(
    () => buildRecursiveIndex([indexObject(1, [0, 0])], configuration()),
  ).toThrow(/zero vector/);

  const nodeId = "semanticIndexNodes:cycle" as Id<"semanticIndexNodes">;
  expect(() => searchRecursiveIndex({
    queryVector: [1, 0],
    rootNodeIds: [nodeId],
    nodes: [{
      id: nodeId,
      centroidVector: [1, 0],
      children: { kind: "nodes", ids: [nodeId] }
    }],
    objects: [searchable(1, [1, 0])],
    topK: 1,
    configuration: configuration(),
    overlayGeneration: 1
  })).toThrow(/revisits node/);
});

test("best-first tree retrieval agrees with exhaustive cosine on separated clusters", () => {
  const objects = [
    searchable(1, [1, 0]),
    searchable(2, [0.99, 0.05]),
    searchable(3, [0.95, -0.1]),
    searchable(4, [0, 1]),
    searchable(5, [0.05, 0.99]),
    searchable(6, [-0.1, 0.95]),
    searchable(7, [-1, 0]),
    searchable(8, [-0.98, -0.05]),
    searchable(9, [-0.95, 0.1])
  ];
  const config = configuration({ leafSize: 2, candidateMultiplier: 2 });
  const tree = materialize(buildRecursiveIndex(objects, config));
  const approximate = searchRecursiveIndex({
    queryVector: [1, 0],
    rootNodeIds: tree.roots,
    nodes: tree.nodes,
    objects,
    topK: 2,
    configuration: config,
    overlayGeneration: 4
  });
  const exact = searchSemanticObjectsExhaustively(objects, [1, 0], 2, 4);

  expect(
    approximate.hits.map((hit) => hit.semanticObjectIds),
  ).toEqual(exact.map((hit) => hit.semanticObjectIds));
  expect(approximate.diagnostics.evaluatedObjects).toBeLessThan(objects.length);
  expect(approximate.hits.every((hit) => hit.overlayGeneration === 4)).toBe(true);
});

test("tree search preserves high exact-top-five recall on a deterministic clustered corpus", () => {
  let state = 0x5eed1234;
  const random = (): number => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
  const dimensions = 12;
  const clusterCount = 12;
  const perCluster = 24;
  const objects = Array.from({ length: clusterCount * perCluster }, (_, index) => {
    const cluster = Math.floor(index / perCluster);
    const vector = Array.from({ length: dimensions }, (_, dimension) =>
      (dimension === cluster ? 1 : 0) + (random() - 0.5) * 0.08
    );
    return searchable(index + 1, vector);
  });
  const config = configuration({
    branchFactor: 4,
    leafSize: 8,
    candidateMultiplier: 8
  });
  const tree = materialize(buildRecursiveIndex(objects, config));
  let recalled = 0;
  let possible = 0;
  let evaluated = 0;

  for (let cluster = 0; cluster < clusterCount; cluster += 1) {
    const query = Array.from({ length: dimensions }, (_, dimension) =>
      dimension === cluster ? 1 : 0.01
    );
    const approximate = searchRecursiveIndex({
      queryVector: query,
      rootNodeIds: tree.roots,
      nodes: tree.nodes,
      objects,
      topK: 5,
      configuration: config,
      overlayGeneration: 1
    });
    const exact = searchSemanticObjectsExhaustively(objects, query, 5, 1);
    const approximateIds = new Set(approximate.hits.flatMap((hit) => hit.semanticObjectIds));
    const exactIds = exact.flatMap((hit) => hit.semanticObjectIds);
    recalled += exactIds.filter((candidate) => approximateIds.has(candidate)).length;
    possible += exactIds.length;
    evaluated += approximate.diagnostics.evaluatedObjects;
  }

  expect(recalled / possible).toBeGreaterThanOrEqual(0.95);
  expect(evaluated / clusterCount).toBeLessThan(objects.length / 3);
});

test("query eligibility filters leaf candidates before exact object scoring", () => {
  const objects = [
    searchable(1, [1, 0]),
    searchable(2, [0.9, 0.1]),
    searchable(3, [0, 1]),
    searchable(4, [0.1, 0.9]),
    searchable(5, [-1, 0]),
    searchable(6, [-0.9, -0.1])
  ];
  const config = configuration({ leafSize: 1, candidateMultiplier: 1 });
  const tree = materialize(buildRecursiveIndex(objects, config));
  const result = searchRecursiveIndex({
    queryVector: [1, 0],
    rootNodeIds: tree.roots,
    nodes: tree.nodes,
    objects,
    eligibleObjectIds: [id(4)],
    topK: 1,
    configuration: config,
    overlayGeneration: 2
  });

  expect(result.hits[0].semanticObjectIds).toEqual([id(4)]);
  expect(result.diagnostics.eligibleObjects).toBe(1);
  expect(result.diagnostics.evaluatedObjects).toBe(1);
});

test("overlapping objects coalesce transitively before topK", () => {
  const source = {
    ref: { kind: "document", id: "documents:1" },
    revision: 3,
    encoding: "utf-8" as const
  };
  const first: SearchableSemanticObject = {
    id: id(1),
    vector: [1, 0],
    source,
    span: { from: 0, to: 10, text: "alpha beta" }
  };
  const second: SearchableSemanticObject = {
    id: id(2),
    vector: [0.9, 0.1],
    source,
    span: { from: 6, to: 16, text: "beta gamma" }
  };
  const third: SearchableSemanticObject = {
    id: id(3),
    vector: [0.8, 0.2],
    source,
    span: { from: 11, to: 22, text: "gamma delta" }
  };

  const [hit] = coalesceSemanticHits(
    [
      { object: third, score: 0.8 },
      { object: first, score: 1 },
      { object: second, score: 0.9 }
    ],
    7
  );

  expect(hit.semanticObjectIds).toEqual([id(1), id(2), id(3)]);
  expect(hit.span).toEqual({ from: 0, to: 22, text: "alpha beta gamma delta" });
  expect(hit.score).toBe(1);
  expect(hit.overlayGeneration).toBe(7);

  const separate: SearchableSemanticObject = {
    id: id(4),
    vector: [0, 1],
    source: { ...source, ref: { kind: "document", id: "documents:2" } },
    span: { from: 0, to: 5, text: "other" }
  };
  const firstRoot = "semanticIndexNodes:first" as Id<"semanticIndexNodes">;
  const secondRoot = "semanticIndexNodes:second" as Id<"semanticIndexNodes">;
  const found = searchRecursiveIndex({
    queryVector: [1, 0],
    rootNodeIds: [firstRoot, secondRoot],
    nodes: [
      {
        id: firstRoot,
        centroidVector: [1, 0],
        children: { kind: "objects", ids: [first.id, second.id] }
      },
      {
        id: secondRoot,
        centroidVector: [0, 1],
        children: { kind: "objects", ids: [separate.id] }
      }
    ],
    objects: [first, second, separate],
    topK: 2,
    configuration: configuration({ candidateMultiplier: 1 }),
    overlayGeneration: 7
  });
  expect(found.hits).toHaveLength(2);
  expect(found.diagnostics.evaluatedObjects).toBe(3);
  expect(found.diagnostics.exhausted).toBe(true);
});

test("touching objects coalesce before topK without splitting a word", () => {
  const source = {
    ref: { kind: "document", id: "documents:touching" },
    revision: 1,
    encoding: "utf-8" as const
  };
  const first: SearchableSemanticObject = {
    id: id(11),
    vector: [1, 0],
    source,
    span: { from: 0, to: 1, text: "G" }
  };
  const second: SearchableSemanticObject = {
    id: id(12),
    vector: [0.9, 0.1],
    source,
    span: { from: 1, to: 18, text: "arry's age is 27." }
  };

  expect(
    coalesceSemanticHits(
      [
        { object: second, score: 0.9 },
        { object: first, score: 1 }
      ],
      9
    )
  ).toEqual([
    {
      semanticObjectIds: [first.id, second.id],
      source,
      span: { from: 0, to: 18, text: "Garry's age is 27." },
      score: 1,
      overlayGeneration: 9
    }
  ]);
});

test("resource scope treats an empty include as project-wide and exclusion wins", () => {
  const ref = { kind: "externalFile::pdf", id: "externalFiles:1" };
  const all: ResourceSet = { include: [], exclude: [] };
  expect(resourceInScope(ref, all, () => undefined)).toBe(true);

  const excluding: ResourceSet = {
    include: [],
    exclude: [{ select: "kinds", kinds: ["externalFile"] }]
  };
  expect(resourceInScope(ref, excluding, () => undefined)).toBe(false);

  const nestedId = "resourceSets:1" as Id<"resourceSets">;
  const nested: ResourceSet = {
    include: [{ select: "set", setId: nestedId }],
    exclude: []
  };
  const selected: ResourceSet = {
    include: [{ select: "resources", refs: [ref] }],
    exclude: []
  };
  expect(resourceInScope(ref, nested, () => selected)).toBe(true);

  const cyclic: ResourceSet = {
    include: [{ select: "set", setId: nestedId }],
    exclude: []
  };
  expect(() => resourceInScope(ref, cyclic, () => cyclic)).toThrow(/cycle/);
});
