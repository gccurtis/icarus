import type {
  AlignedTokenField,
  AttractionPoint,
  AttractionPeak,
  SegmentRange,
  SegmentationResult,
  TranslationConfiguration
} from "$representation/data/types/semantic/translation";

const EPSILON = 1e-12;

type Candidate = {
  boundarySpan: number;
  boundaryPositionTokens: number;
  sourceOffset: number;
  semanticChange: number;
};

type Basin = {
  members: number[];
  peakIndex: number;
  mass: number;
};

type BasinMetric = { prominence: number };

const validateConfiguration = (configuration: TranslationConfiguration): void => {
  const values = [
    configuration.maxTokens,
    configuration.minTokens,
    configuration.changeThreshold,
    configuration.basinProminenceThreshold,
    configuration.basinMassFraction,
    configuration.attractionDecayTokens,
    configuration.attractionStationaryThreshold
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Translation configuration values must be finite numbers");
  }
  if (
    !Number.isInteger(configuration.minTokens) ||
    !Number.isInteger(configuration.maxTokens) ||
    configuration.minTokens < 1 ||
    configuration.minTokens > configuration.maxTokens
  ) {
    throw new Error("Translation token sizes must satisfy 1 <= minTokens <= maxTokens");
  }
  if (configuration.changeThreshold < 0 || configuration.changeThreshold > 2) {
    throw new Error("changeThreshold must be between 0 and 2");
  }
  if (
    configuration.basinProminenceThreshold < 0 ||
    configuration.basinProminenceThreshold > 2
  ) {
    throw new Error("basinProminenceThreshold must be between 0 and 2");
  }
  if (configuration.basinMassFraction < 0 || configuration.basinMassFraction > 1) {
    throw new Error("basinMassFraction must be between 0 and 1");
  }
  if (!(configuration.attractionDecayTokens > 0)) {
    throw new Error("attractionDecayTokens must be positive");
  }
  if (configuration.attractionStationaryThreshold < 0) {
    throw new Error("attractionStationaryThreshold must not be negative");
  }
};

const validateField = (field: AlignedTokenField): number => {
  if (field.spans.length === 0 || field.spans.length !== field.vectors.length) {
    throw new Error("Aligned spans and vectors must be non-empty and have equal length");
  }
  const dimensions = field.vectors[0]?.length ?? 0;
  if (dimensions < 1) throw new Error("Aligned token vectors must not be empty");
  for (let index = 0; index < field.spans.length; index += 1) {
    const span = field.spans[index];
    if (
      !Number.isInteger(span.from) ||
      !Number.isInteger(span.to) ||
      span.from < 0 ||
      span.to <= span.from ||
      !Number.isInteger(span.modelTokens) ||
      span.modelTokens < 1
    ) {
      throw new Error("Aligned token spans must be ordered, non-empty, and token-backed");
    }
    if (index > 0 && field.spans[index - 1].to !== span.from) {
      throw new Error("Aligned token spans must be contiguous");
    }
    const row = field.vectors[index];
    if (row.length !== dimensions || row.some((value) => !Number.isFinite(value))) {
      throw new Error("Aligned token vectors must share one finite dimension");
    }
  }
  return dimensions;
};

const prefixes = (field: AlignedTokenField, dimensions: number) => {
  const tokenPrefix = [0];
  const vectorPrefix = [Array.from({ length: dimensions }, () => 0)];
  for (let index = 0; index < field.spans.length; index += 1) {
    tokenPrefix.push(tokenPrefix[index] + field.spans[index].modelTokens);
    vectorPrefix.push(
      vectorPrefix[index].map((value, column) => value + field.vectors[index][column])
    );
  }
  return { tokenPrefix, vectorPrefix };
};

const regionVector = (prefix: number[][], from: number, to: number): number[] =>
  prefix[to].map((value, column) => value - prefix[from][column]);

const cosine = (left: number[], right: number[]): number => {
  let dot = 0;
  let leftSquared = 0;
  let rightSquared = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftSquared += left[index] * left[index];
    rightSquared += right[index] * right[index];
  }
  const denominator = Math.sqrt(leftSquared) * Math.sqrt(rightSquared);
  return denominator === 0 ? 0 : dot / denominator;
};

const candidateDistribution = (
  from: number,
  to: number,
  field: AlignedTokenField,
  tokenPrefix: number[],
  vectorPrefix: number[][],
  configuration: TranslationConfiguration
): Candidate[] => {
  const output: Candidate[] = [];
  for (let boundary = from + 1; boundary < to; boundary += 1) {
    const leftTokens = tokenPrefix[boundary] - tokenPrefix[from];
    const rightTokens = tokenPrefix[to] - tokenPrefix[boundary];
    if (leftTokens < configuration.minTokens || rightTokens < configuration.minTokens) continue;
    const similarity = cosine(
      regionVector(vectorPrefix, from, boundary),
      regionVector(vectorPrefix, boundary, to)
    );
    output.push({
      boundarySpan: boundary,
      boundaryPositionTokens: tokenPrefix[boundary],
      sourceOffset: field.spans[boundary].from,
      semanticChange: Math.min(2, Math.max(0, 1 - similarity))
    });
  }
  return output;
};

const ascentPeak = (start: number, changes: number[]): number => {
  let index = start;
  while (true) {
    const value = changes[index];
    let plateauFrom = index;
    let plateauTo = index;
    while (plateauFrom > 0 && Math.abs(changes[plateauFrom - 1] - value) <= EPSILON) {
      plateauFrom -= 1;
    }
    while (
      plateauTo < changes.length - 1 &&
      Math.abs(changes[plateauTo + 1] - value) <= EPSILON
    ) {
      plateauTo += 1;
    }
    const left = plateauFrom > 0 ? changes[plateauFrom - 1] : Number.NEGATIVE_INFINITY;
    const right =
      plateauTo < changes.length - 1
        ? changes[plateauTo + 1]
        : Number.NEGATIVE_INFINITY;
    if (left <= value + EPSILON && right <= value + EPSILON) {
      return Math.floor((plateauFrom + plateauTo) / 2);
    }
    index = right > left ? plateauTo + 1 : plateauFrom - 1;
  }
};

const initialBasins = (candidates: Candidate[]): Basin[] => {
  if (candidates.length === 0) return [];
  const changes = candidates.map((candidate) => candidate.semanticChange);
  const owned = new Map<number, number[]>();
  for (let index = 0; index < candidates.length; index += 1) {
    const peak = ascentPeak(index, changes);
    const members = owned.get(peak);
    if (members) members.push(index);
    else owned.set(peak, [index]);
  }
  const floor = changes.reduce((minimum, change) => Math.min(minimum, change));
  return [...owned.entries()]
    .map(([peakIndex, members]) => ({
      peakIndex,
      members,
      mass: members.reduce((sum, member) => sum + Math.max(0, changes[member] - floor), 0)
    }))
    .sort((left, right) => left.members[0] - right.members[0]);
};

const basinMetrics = (basins: Basin[], candidates: Candidate[]): BasinMetric[] => {
  if (basins.length === 0) return [];
  const changes = candidates.map((candidate) => candidate.semanticChange);
  const floor = changes.reduce((minimum, change) => Math.min(minimum, change));
  return basins.map((basin) => {
    const peakValue = changes[basin.peakIndex];
    const saddles: number[] = [];
    for (const other of basins) {
      if (changes[other.peakIndex] <= peakValue + EPSILON) continue;
      const from = Math.min(basin.peakIndex, other.peakIndex);
      const to = Math.max(basin.peakIndex, other.peakIndex);
      let saddle = changes[from];
      for (let index = from + 1; index <= to; index += 1) {
        saddle = Math.min(saddle, changes[index]);
      }
      saddles.push(saddle);
    }
    const reference =
      saddles.length > 0
        ? saddles.reduce((maximum, saddle) => Math.max(maximum, saddle))
        : floor;
    return { prominence: Math.max(0, peakValue - reference) };
  });
};

/**
 * Signed attraction at one candidate boundary:
 * Σ (c_j - c_i) exp(-|x_j - x_i| / decay) sign(x_j - x_i), for c_j > c_i.
 */
export const distanceDiscountedPull = (
  peak: AttractionPoint,
  candidates: AttractionPoint[],
  decayTokens: number
): number => {
  if (!(decayTokens > 0)) throw new Error("Attraction decay must be positive");
  if (
    !Number.isFinite(peak.boundaryPositionTokens) ||
    !Number.isFinite(peak.semanticChange) ||
    candidates.some(
      (candidate) =>
        !Number.isFinite(candidate.boundaryPositionTokens) ||
        !Number.isFinite(candidate.semanticChange)
    )
  ) {
    throw new Error("Attraction points must contain finite values");
  }
  let pull = 0;
  for (const candidate of candidates) {
    const changeDifference = candidate.semanticChange - peak.semanticChange;
    const positionDifference = candidate.boundaryPositionTokens - peak.boundaryPositionTokens;
    if (changeDifference <= EPSILON || Math.abs(positionDifference) <= EPSILON) continue;
    const influence = changeDifference * Math.exp(-Math.abs(positionDifference) / decayTokens);
    pull += positionDifference > 0 ? influence : -influence;
  }
  return pull;
};

const spacingViolation = (
  active: Basin[],
  candidates: Candidate[],
  tokenPrefix: number[],
  minTokens: number
): [number, number] | undefined => {
  for (let index = 0; index < active.length - 1; index += 1) {
    const left = candidates[active[index].peakIndex].boundarySpan;
    const right = candidates[active[index + 1].peakIndex].boundarySpan;
    if (tokenPrefix[right] - tokenPrefix[left] < minTokens) return [index, index + 1];
  }
  return undefined;
};

const survivorRank = (
  basin: Basin,
  pull: number,
  candidates: Candidate[]
): [number, number, number, number] => [
  Math.abs(pull),
  -basin.mass,
  -candidates[basin.peakIndex].semanticChange,
  basin.peakIndex
];

const lexicographicLess = (left: number[], right: number[]): boolean => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index];
  }
  return false;
};

const suppressCloseAttractors = (
  stationary: Basin[],
  pullByPeak: Map<number, number>,
  candidates: Candidate[],
  tokenPrefix: number[],
  minTokens: number
): Basin[] => {
  const active = [...stationary].sort((left, right) => left.peakIndex - right.peakIndex);
  while (active.length > 1) {
    const violation = spacingViolation(active, candidates, tokenPrefix, minTokens);
    if (!violation) break;
    const [leftIndex, rightIndex] = violation;
    const left = active[leftIndex];
    const right = active[rightIndex];
    const leftRank = survivorRank(left, pullByPeak.get(left.peakIndex) ?? 0, candidates);
    const rightRank = survivorRank(right, pullByPeak.get(right.peakIndex) ?? 0, candidates);
    active.splice(lexicographicLess(leftRank, rightRank) ? rightIndex : leftIndex, 1);
  }
  return active;
};

const rangesFromCuts = (
  spanCount: number,
  selected: Basin[],
  candidates: Candidate[]
): SegmentRange[] => {
  const cuts = [...new Set(selected.map((basin) => candidates[basin.peakIndex].boundarySpan))].sort(
    (left, right) => left - right
  );
  const boundaries = [0, ...cuts, spanCount];
  return boundaries.slice(1).map((toSpan, index) => ({
    fromSpan: boundaries[index],
    toSpan
  }));
};

const halfwayBoundary = (from: number, to: number, tokenPrefix: number[]): number => {
  const target = (tokenPrefix[from] + tokenPrefix[to]) / 2;
  for (let boundary = from + 1; boundary < to; boundary += 1) {
    if (tokenPrefix[boundary] >= target) return boundary;
  }
  return to - 1;
};

const enforceHardMax = (
  ranges: SegmentRange[],
  field: AlignedTokenField,
  tokenPrefix: number[],
  vectorPrefix: number[][],
  configuration: TranslationConfiguration
): SegmentRange[] => {
  const output: SegmentRange[] = [];
  const visit = (range: SegmentRange): void => {
    const total = tokenPrefix[range.toSpan] - tokenPrefix[range.fromSpan];
    if (total <= configuration.maxTokens || range.toSpan - range.fromSpan <= 1) {
      output.push(range);
      return;
    }
    const candidates = candidateDistribution(
      range.fromSpan,
      range.toSpan,
      field,
      tokenPrefix,
      vectorPrefix,
      configuration
    );
    let chosen: Candidate | undefined;
    for (const candidate of candidates) {
      if (
        chosen === undefined ||
        candidate.semanticChange > chosen.semanticChange ||
        (candidate.semanticChange === chosen.semanticChange &&
          candidate.boundarySpan < chosen.boundarySpan)
      ) {
        chosen = candidate;
      }
    }
    let boundary = chosen?.boundarySpan;
    if (boundary === undefined) {
      boundary = halfwayBoundary(range.fromSpan, range.toSpan, tokenPrefix);
    }
    visit({ fromSpan: range.fromSpan, toSpan: boundary });
    visit({ fromSpan: boundary, toSpan: range.toSpan });
  };
  for (const range of ranges) visit(range);
  return output;
};

/** Apply the fixed distance-discounted-attraction policy to an aligned field. */
export const segmentAlignedField = (
  field: AlignedTokenField,
  configuration: TranslationConfiguration
): SegmentationResult => {
  validateConfiguration(configuration);
  const dimensions = validateField(field);
  const { tokenPrefix, vectorPrefix } = prefixes(field, dimensions);
  const candidates = candidateDistribution(
    0,
    field.spans.length,
    field,
    tokenPrefix,
    vectorPrefix,
    configuration
  );
  const basins = initialBasins(candidates);
  const metrics = basinMetrics(basins, candidates);
  const totalMass = basins.reduce((sum, basin) => sum + basin.mass, 0);
  const pulls = basins.map((basin) =>
    distanceDiscountedPull(
      candidates[basin.peakIndex],
      candidates,
      configuration.attractionDecayTokens
    )
  );
  const stationary = basins.filter((basin, index) => {
    const massFraction =
      totalMass <= EPSILON ? 1 / Math.max(1, basins.length) : basin.mass / totalMass;
    return (
      Math.abs(pulls[index]) <= configuration.attractionStationaryThreshold &&
      candidates[basin.peakIndex].semanticChange >= configuration.changeThreshold &&
      metrics[index].prominence >= configuration.basinProminenceThreshold &&
      massFraction >= configuration.basinMassFraction
    );
  });
  const pullByPeak = new Map(basins.map((basin, index) => [basin.peakIndex, pulls[index]]));
  const selected = suppressCloseAttractors(
    stationary,
    pullByPeak,
    candidates,
    tokenPrefix,
    configuration.minTokens
  );
  const selectedPeaks = new Set(selected.map((basin) => basin.peakIndex));
  const peaks: AttractionPeak[] = basins.map((basin, index) => {
    const candidate = candidates[basin.peakIndex];
    const massFraction =
      totalMass <= EPSILON ? 1 / Math.max(1, basins.length) : basin.mass / totalMass;
    const stationaryPeak =
      Math.abs(pulls[index]) <= configuration.attractionStationaryThreshold;
    const eligible =
      candidate.semanticChange >= configuration.changeThreshold &&
      metrics[index].prominence >= configuration.basinProminenceThreshold &&
      massFraction >= configuration.basinMassFraction;
    return {
      candidateIndex: basin.peakIndex,
      boundarySpan: candidate.boundarySpan,
      boundaryPositionTokens: candidate.boundaryPositionTokens,
      sourceOffset: candidate.sourceOffset,
      semanticChange: candidate.semanticChange,
      basinMass: basin.mass,
      massFraction,
      prominence: metrics[index].prominence,
      signedPull: pulls[index],
      stationary: stationaryPeak,
      eligible,
      selected: selectedPeaks.has(basin.peakIndex)
    };
  });
  const ranges = enforceHardMax(
    rangesFromCuts(field.spans.length, selected, candidates),
    field,
    tokenPrefix,
    vectorPrefix,
    configuration
  );
  return { ranges, peaks };
};
