import type {
  IndexableSemanticObject,
  RecursiveIndexBuild,
  RecursiveIndexConfiguration,
  SemanticIndexNodeDraft
} from "$representation/data/types/semantic/index";
import {
  dotProduct,
  normalizeVector,
  sphericalCentroid,
  validateVector
} from "$representation/data/behavior/semantic/vector";

type Member = {
  readonly id: IndexableSemanticObject["id"];
  readonly vector: number[];
};

const compareId = (left: Member, right: Member): number =>
  left.id < right.id ? -1 : left.id > right.id ? 1 : 0;

export const validateRecursiveIndexConfiguration = (
  configuration: RecursiveIndexConfiguration
): void => {
  const integerKeys = ["branchFactor", "leafSize", "maxIterations", "candidateMultiplier"] as const;
  for (const key of integerKeys) {
    if (!Number.isInteger(configuration[key]) || configuration[key] < 1) {
      throw new Error(`semantic index ${key} must be a positive integer`);
    }
  }
  if (configuration.branchFactor < 2) {
    throw new Error("semantic index branchFactor must be at least two");
  }
  if (
    !Number.isFinite(configuration.convergenceTolerance) ||
    configuration.convergenceTolerance < 0 ||
    configuration.convergenceTolerance > 2
  ) {
    throw new Error("semantic index convergenceTolerance must be between zero and two");
  }
};

const centroidOf = (members: readonly Member[]): number[] =>
  sphericalCentroid(
    members.map((member) => member.vector),
    members[0].vector
  );

/** Farthest-first seeds remove randomness and make the tree reproducible. */
const seedsFor = (members: readonly Member[], count: number): number[][] => {
  const corpusCentroid = centroidOf(members);
  const unchosen = new Set(members.map((member) => member.id));
  const seeds: number[][] = [];

  while (seeds.length < count) {
    let chosen: Member | undefined;
    let chosenDistance = -Infinity;
    for (const member of members) {
      if (!unchosen.has(member.id)) continue;
      const nearestSimilarity =
        seeds.length === 0
          ? dotProduct(member.vector, corpusCentroid)
          : Math.max(...seeds.map((seed) => dotProduct(member.vector, seed)));
      const distance = 1 - nearestSimilarity;
      if (
        distance > chosenDistance ||
        (distance === chosenDistance && chosen !== undefined && compareId(member, chosen) < 0)
      ) {
        chosen = member;
        chosenDistance = distance;
      }
    }
    if (chosen === undefined) throw new Error("could not choose a semantic index seed");
    seeds.push([...chosen.vector]);
    unchosen.delete(chosen.id);
  }
  return seeds;
};

const assign = (members: readonly Member[], centroids: readonly number[][]): Member[][] => {
  const groups = centroids.map(() => [] as Member[]);
  for (const member of members) {
    let best = 0;
    let bestScore = dotProduct(member.vector, centroids[0]);
    for (let index = 1; index < centroids.length; index += 1) {
      const score = dotProduct(member.vector, centroids[index]);
      if (score > bestScore) {
        best = index;
        bestScore = score;
      }
    }
    groups[best].push(member);
  }
  return groups;
};

/** Every empty cluster receives the least-similar member of the largest donor. */
const repairEmptyGroups = (groups: Member[][], centroids: readonly number[][]): void => {
  for (let empty = 0; empty < groups.length; empty += 1) {
    if (groups[empty].length > 0) continue;
    let donor = -1;
    for (let index = 0; index < groups.length; index += 1) {
      if (
        groups[index].length > 1 &&
        (donor < 0 || groups[index].length > groups[donor].length)
      ) {
        donor = index;
      }
    }
    if (donor < 0) throw new Error("semantic index could not repair an empty cluster");

    const ordered = [...groups[donor]].sort((left, right) => {
      const distance = dotProduct(left.vector, centroids[donor]) - dotProduct(right.vector, centroids[donor]);
      return distance || compareId(left, right);
    });
    const moved = ordered[0];
    groups[donor] = groups[donor].filter((member) => member.id !== moved.id);
    groups[empty].push(moved);
  }
};

const membershipKey = (groups: readonly Member[][]): string =>
  groups.map((group) => group.map((member) => member.id).sort().join(",")).join("|");

/** Deterministic spherical k-means over already-normalized embeddings. */
export const sphericalPartition = (
  input: readonly Member[],
  count: number,
  configuration: RecursiveIndexConfiguration
): Member[][] => {
  if (!Number.isInteger(count) || count < 2 || count > input.length) {
    throw new Error("semantic partition count must be between two and the member count");
  }
  const members = [...input].sort(compareId);
  let centroids = seedsFor(members, count);
  let previousMembership: string | undefined;
  let groups = centroids.map(() => [] as Member[]);

  for (let iteration = 0; iteration < configuration.maxIterations; iteration += 1) {
    groups = assign(members, centroids);
    repairEmptyGroups(groups, centroids);
    groups.forEach((group) => group.sort(compareId));
    const nextCentroids = groups.map(centroidOf);
    const displacement = Math.max(
      ...centroids.map((centroid, index) => 1 - dotProduct(centroid, nextCentroids[index]))
    );
    const membership = membershipKey(groups);
    centroids = nextCentroids;
    if (membership === previousMembership || displacement <= configuration.convergenceTolerance) {
      break;
    }
    previousMembership = membership;
  }
  return groups;
};

const membersOf = (objects: readonly IndexableSemanticObject[]): Member[] => {
  const seen = new Set<string>();
  let dimensions: number | undefined;
  return [...objects]
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    .map((object) => {
      if (seen.has(object.id)) throw new Error(`duplicate semantic object id '${object.id}'`);
      seen.add(object.id);
      dimensions ??= object.vector.length;
      validateVector(object.vector, dimensions, `semantic object '${object.id}' vector`);
      return { id: object.id, vector: normalizeVector(object.vector) };
    });
};

/** Builds a deterministic forest; paths become stable draft keys, not row IDs. */
export const buildRecursiveIndex = (
  objects: readonly IndexableSemanticObject[],
  configuration: RecursiveIndexConfiguration
): RecursiveIndexBuild => {
  validateRecursiveIndexConfiguration(configuration);
  const members = membersOf(objects);
  if (members.length === 0) return { rootKeys: [], nodes: [] };

  const nodes: SemanticIndexNodeDraft[] = [];
  const buildNode = (group: Member[], key: string, parentKey?: string): void => {
    const centroidVector = centroidOf(group);
    if (group.length <= configuration.leafSize) {
      nodes.push({
        key,
        ...(parentKey ? { parentKey } : {}),
        centroidVector,
        children: { kind: "objects", ids: group.map((member) => member.id) }
      });
      return;
    }

    const count = Math.min(
      configuration.branchFactor,
      Math.max(2, Math.ceil(group.length / configuration.leafSize))
    );
    const partitions = sphericalPartition(group, count, configuration);
    const keys = partitions.map((_, index) => `${key}.${index}`);
    nodes.push({
      key,
      ...(parentKey ? { parentKey } : {}),
      centroidVector,
      children: { kind: "nodes", keys }
    });
    partitions.forEach((partition, index) => buildNode(partition, keys[index], key));
  };

  const roots =
    members.length <= configuration.leafSize
      ? [members]
      : sphericalPartition(
          members,
          Math.min(
            configuration.branchFactor,
            Math.max(2, Math.ceil(members.length / configuration.leafSize))
          ),
          configuration
        );
  const rootKeys = roots.map((_, index) => String(index));
  roots.forEach((root, index) => buildNode(root, rootKeys[index]));
  return { rootKeys, nodes };
};
