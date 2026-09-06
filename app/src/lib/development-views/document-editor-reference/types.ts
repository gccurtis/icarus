export type AreaSlug = "context" | "inspector" | "content" | "runtime" | "backend";

export type ChangeStatus = "A" | "M" | "D";
export type FileKind = "production" | "test" | "fixture" | "documentation" | "reference" | "configuration";
export type ReviewTone = "settled" | "watch" | "deferred";

export type FlowStep = {
  actor: string;
  action: string;
  artifact?: string;
};

export type Flow = {
  id: string;
  title: string;
  trigger: string;
  steps: FlowStep[];
  outcome: string;
  failure?: string;
};

export type Domain = {
  name: string;
  owner: string;
  shape: string;
  states?: string[];
  transitions?: string[];
  invariants: string[];
  sources: string[];
};

export type Procedure = {
  name: string;
  role: string;
  reads: string;
  writes: string;
  failure: string;
  sources: string[];
};

export type Change = {
  title: string;
  before: string;
  now: string;
  why: string;
};

export type StructureEntry = {
  path: string;
  role: string;
  note: string;
};

export type ReviewNote = {
  tone: ReviewTone;
  title: string;
  detail: string;
};

export type AreaReference = {
  slug: AreaSlug;
  index: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  summary: string;
  contract: string;
  owns: string[];
  doesNotOwn: string[];
  changes: Change[];
  flows: Flow[];
  domains: Domain[];
  procedures: Procedure[];
  structure: StructureEntry[];
  review: ReviewNote[];
  related: AreaSlug[];
};

export type FileRecord = {
  path: string;
  status: ChangeStatus;
  area: AreaSlug | "cross-cutting" | "evidence";
  kind: FileKind;
  current: number;
  base: number;
  added: number;
  deleted: number;
  binary?: boolean;
};
