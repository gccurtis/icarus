import { coordinateLength, sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import { validateRecursiveIndexConfiguration } from "$representation/data/behavior/semantic/recursive-index";
import {
  dotProduct,
  normalizeVector,
  validateVector
} from "$representation/data/behavior/semantic/vector";
import type { Id } from "$representation/data/types/core/id";
import type {
  RecursiveQueryInput,
  RecursiveQueryResult,
  SearchableSemanticIndexNode,
  SearchableSemanticObject,
  SemanticHit
} from "$representation/data/types/semantic/index";

type ScoredObject = {
  readonly object: SearchableSemanticObject;
  readonly score: number;
};

type FrontierItem = {
  readonly id: Id<"semanticIndexNodes">;
  readonly score: number;
};

const assertSpan = (object: SearchableSemanticObject): void => {
  const { from, to, text } = object.span;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to <= from) {
    throw new Error(`semantic object '${object.id}' has invalid span coordinates`);
  }
  if (coordinateLength(text, object.source.encoding) !== to - from) {
    throw new Error(`semantic object '${object.id}' span text does not match its coordinates`);
  }
};

const sourceKey = (object: SearchableSemanticObject): string =>
  JSON.stringify([
    object.source.ref.kind,
    object.source.ref.id,
    object.source.revision,
    object.source.encoding
  ]);

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const mergedHit = (
  group: readonly ScoredObject[],
  overlayGeneration: number
): SemanticHit => {
  const ordered = [...group].sort((left, right) =>
    left.object.span.from - right.object.span.from ||
    left.object.span.to - right.object.span.to ||
    (left.object.id < right.object.id ? -1 : 1)
  );
  const first = ordered[0];
  let from = first.object.span.from;
  let to = first.object.span.to;
  let text = first.object.span.text;
  let score = first.score;

  for (const entry of ordered.slice(1)) {
    const span = entry.object.span;
    const sharedFrom = Math.max(from, span.from);
    const sharedTo = Math.min(to, span.to);
    const encoding = first.object.source.encoding;
    const existingOverlap = sliceByCoordinates(text, encoding, sharedFrom - from, sharedTo - from);
    const nextOverlap = sliceByCoordinates(
      span.text,
      encoding,
      sharedFrom - span.from,
      sharedTo - span.from
    );
    if (existingOverlap !== nextOverlap) {
      throw new Error("overlapping semantic spans disagree on their source text");
    }
    if (span.to > to) {
      text += sliceByCoordinates(span.text, encoding, to - span.from, span.to - span.from);
      to = span.to;
    }
    score = Math.max(score, entry.score);
  }

  return {
    semanticObjectIds: ordered.map((entry) => entry.object.id),
    source: first.object.source,
    span: { from, to, text },
    score,
    overlayGeneration
  };
};

/** Connected components of overlapping or touching intervals, grouped by source revision. */
export const coalesceSemanticHits = (
  scored: readonly ScoredObject[],
  overlayGeneration: number
): SemanticHit[] => {
  const bySource = new Map<string, ScoredObject[]>();
  for (const entry of scored) {
    assertSpan(entry.object);
    const key = sourceKey(entry.object);
    bySource.set(key, [...(bySource.get(key) ?? []), entry]);
  }

  const hits: SemanticHit[] = [];
  for (const entries of bySource.values()) {
    const ordered = [...entries].sort((left, right) =>
      left.object.span.from - right.object.span.from ||
      left.object.span.to - right.object.span.to ||
      (left.object.id < right.object.id ? -1 : 1)
    );
    let group: ScoredObject[] = [];
    let groupTo = -1;
    for (const entry of ordered) {
      if (group.length === 0 || entry.object.span.from <= groupTo) {
        group.push(entry);
        groupTo = Math.max(groupTo, entry.object.span.to);
      } else {
        hits.push(mergedHit(group, overlayGeneration));
        group = [entry];
        groupTo = entry.object.span.to;
      }
    }
    if (group.length > 0) hits.push(mergedHit(group, overlayGeneration));
  }

  return hits.sort((left, right) =>
    right.score - left.score ||
    compareText(left.source.ref.kind, right.source.ref.kind) ||
    compareText(left.source.ref.id, right.source.ref.id) ||
    left.span.from - right.span.from
  );
};

const higherPriority = (left: FrontierItem, right: FrontierItem): boolean =>
  left.score > right.score || (left.score === right.score && left.id < right.id);

const push = (heap: FrontierItem[], item: FrontierItem): void => {
  heap.push(item);
  let child = heap.length - 1;
  while (child > 0) {
    const parent = Math.floor((child - 1) / 2);
    if (!higherPriority(heap[child], heap[parent])) break;
    [heap[parent], heap[child]] = [heap[child], heap[parent]];
    child = parent;
  }
};

const pop = (heap: FrontierItem[]): FrontierItem | undefined => {
  const first = heap[0];
  const last = heap.pop();
  if (first === undefined || last === undefined || heap.length === 0) return first;
  heap[0] = last;
  let parent = 0;
  while (true) {
    const left = parent * 2 + 1;
    const right = left + 1;
    let best = parent;
    if (left < heap.length && higherPriority(heap[left], heap[best])) best = left;
    if (right < heap.length && higherPriority(heap[right], heap[best])) best = right;
    if (best === parent) break;
    [heap[parent], heap[best]] = [heap[best], heap[parent]];
    parent = best;
  }
  return first;
};

const scoredObjects = (
  ids: Iterable<Id<"semanticObjects">>,
  objects: ReadonlyMap<Id<"semanticObjects">, SearchableSemanticObject>,
  query: readonly number[]
): ScoredObject[] =>
  [...ids].map((id) => {
    const object = objects.get(id);
    if (object === undefined) throw new Error(`semantic index names missing object '${id}'`);
    assertSpan(object);
    validateVector(object.vector, query.length, `object '${object.id}' vector`);
    return { object, score: dotProduct(query, normalizeVector(object.vector)) };
  });

/** Counts provisional overlap groups without touching high-dimensional object vectors. */
const coalescedCandidateCount = (
  ids: Iterable<Id<"semanticObjects">>,
  objects: ReadonlyMap<Id<"semanticObjects">, SearchableSemanticObject>,
  overlayGeneration: number
): number => coalesceSemanticHits(
  [...ids].map((id) => {
    const object = objects.get(id);
    if (object === undefined) throw new Error(`semantic index names missing object '${id}'`);
    return { object, score: 0 };
  }),
  overlayGeneration
).length;

const mapsFor = (input: RecursiveQueryInput) => {
  const objects = new Map<Id<"semanticObjects">, SearchableSemanticObject>();
  for (const object of input.objects) {
    if (objects.has(object.id)) throw new Error(`duplicate semantic object id '${object.id}'`);
    objects.set(object.id, object);
  }
  const nodes = new Map<Id<"semanticIndexNodes">, SearchableSemanticIndexNode>();
  for (const node of input.nodes) {
    if (nodes.has(node.id)) throw new Error(`duplicate semantic index node id '${node.id}'`);
    nodes.set(node.id, node);
  }
  return { objects, nodes };
};

/** Exact cosine over every eligible object; the oracle used to measure tree recall. */
export const searchSemanticObjectsExhaustively = (
  objects: readonly SearchableSemanticObject[],
  queryVector: readonly number[],
  topK: number,
  overlayGeneration: number
): SemanticHit[] => {
  if (!Number.isInteger(topK) || topK < 1) throw new Error("semantic query topK must be positive");
  const query = normalizeVector(queryVector, "semantic query vector");
  const map = new Map(objects.map((object) => [object.id, object]));
  return coalesceSemanticHits(
    scoredObjects(map.keys(), map, query),
    overlayGeneration
  ).slice(0, topK);
};

/** Best-first centroid traversal followed by exact scoring and span coalescing. */
export const searchRecursiveIndex = (input: RecursiveQueryInput): RecursiveQueryResult => {
  validateRecursiveIndexConfiguration(input.configuration);
  if (!Number.isInteger(input.topK) || input.topK < 1) {
    throw new Error("semantic query topK must be positive");
  }
  if (!Number.isInteger(input.overlayGeneration) || input.overlayGeneration < 0) {
    throw new Error("semantic query overlayGeneration must be a non-negative integer");
  }

  const { objects, nodes } = mapsFor(input);
  const dimensions = input.queryVector.length;
  validateVector(input.queryVector, undefined, "semantic query vector");
  const query = normalizeVector(input.queryVector, "semantic query vector");
  const nodeScore = (node: SearchableSemanticIndexNode): number => {
    validateVector(node.centroidVector, dimensions, `node '${node.id}' centroid`);
    return dotProduct(query, normalizeVector(node.centroidVector));
  };

  const eligible = new Set<Id<"semanticObjects">>(
    input.eligibleObjectIds ?? [...objects.keys()]
  );
  for (const id of eligible) {
    if (!objects.has(id)) throw new Error(`semantic scope names missing object '${id}'`);
  }
  const candidateTarget = Math.min(
    eligible.size,
    Math.max(input.topK, input.topK * input.configuration.candidateMultiplier)
  );
  if (eligible.size === 0) {
    return {
      hits: [],
      diagnostics: {
        eligibleObjects: 0,
        candidateTarget: 0,
        visitedNodes: 0,
        evaluatedObjects: 0,
        exhausted: true
      }
    };
  }

  const frontier: FrontierItem[] = [];
  const enqueued = new Set<Id<"semanticIndexNodes">>();
  const enqueue = (id: Id<"semanticIndexNodes">, node: SearchableSemanticIndexNode): void => {
    if (enqueued.has(id)) throw new Error(`semantic index revisits node '${id}'`);
    enqueued.add(id);
    push(frontier, { id, score: nodeScore(node) });
  };
  for (const id of input.rootNodeIds) {
    const node = nodes.get(id);
    if (node === undefined) throw new Error(`semantic index names missing root '${id}'`);
    enqueue(id, node);
  }
  if (frontier.length === 0) throw new Error("a non-empty Semantic Overlay index requires roots");

  const candidates = new Set<Id<"semanticObjects">>();
  const expanded = new Set<Id<"semanticIndexNodes">>();
  let visitedNodes = 0;
  let stoppedAtBudget = false;
  let nextCandidateCheck = candidateTarget;
  while (frontier.length > 0) {
    const next = pop(frontier);
    if (next === undefined) break;
    if (expanded.has(next.id)) {
      throw new Error(`semantic index revisits node '${next.id}'`);
    }
    expanded.add(next.id);
    const node = nodes.get(next.id);
    if (node === undefined) throw new Error(`semantic index names missing node '${next.id}'`);
    visitedNodes += 1;

    if (node.children.kind === "objects") {
      for (const id of node.children.ids) {
        if (!objects.has(id)) throw new Error(`semantic index names missing object '${id}'`);
        if (eligible.has(id)) candidates.add(id);
      }
    } else {
      for (const id of node.children.ids) {
        const child = nodes.get(id);
        if (child === undefined) throw new Error(`semantic index names missing node '${id}'`);
        enqueue(id, child);
      }
    }

    if (candidates.size >= nextCandidateCheck) {
      const available = coalescedCandidateCount(
        candidates,
        objects,
        input.overlayGeneration
      );
      if (available >= input.topK) {
        stoppedAtBudget = true;
        break;
      }
      if (candidates.size === eligible.size) break;
      nextCandidateCheck = Math.min(
        eligible.size,
        Math.max(candidates.size + 1, nextCandidateCheck * 2)
      );
    }
  }

  const scored = scoredObjects(candidates, objects, query);
  return {
    hits: coalesceSemanticHits(scored, input.overlayGeneration).slice(0, input.topK),
    diagnostics: {
      eligibleObjects: eligible.size,
      candidateTarget,
      visitedNodes,
      evaluatedObjects: candidates.size,
      exhausted: candidates.size === eligible.size || (!stoppedAtBudget && frontier.length === 0)
    }
  };
};
