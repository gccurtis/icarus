export type CheckerStatus = "Enforced" | "Partial" | "Missing";
export type CheckerWave = 1 | 2 | 3 | 4;

export type CheckerSpec = {
  readonly id: string;
  readonly name: string;
  readonly status: CheckerStatus;
  readonly wave: CheckerWave;
  readonly mechanism: string;
  readonly guarantee: string;
  readonly detects: string;
  readonly implementation: string;
  readonly current: string;
  readonly limit: string;
};

export type PillarExample = {
  readonly title: string;
  readonly source: string;
  readonly shape: string;
  readonly observed: string;
  readonly antagonism: string;
  readonly repair: string;
  readonly nuance?: string;
};

export type EquivalenceClass = {
  readonly rule: string;
  readonly generalRepair: string;
  readonly members: readonly string[];
};

export type ArchitecturePillar = {
  readonly code: string;
  readonly slug: string;
  readonly name: string;
  readonly short: string;
  readonly thesis: string;
  readonly supports: string;
  readonly contract: readonly string[];
  readonly example: PillarExample;
  readonly equivalence: EquivalenceClass;
  readonly desiredFlow: readonly string[];
  readonly checkers: readonly CheckerSpec[];
  readonly rollout: readonly string[];
  readonly relatedFindings: readonly string[];
};

export type CheckerCount = {
  readonly status: CheckerStatus;
  readonly count: number;
};
