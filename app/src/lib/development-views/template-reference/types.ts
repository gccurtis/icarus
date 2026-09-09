export type Area =
  | "vocabulary"
  | "templates"
  | "sets"
  | "neighbours"
  | "editors"
  | "library"
  | "contexts"
  | "evidence"
  | "reference"
  | "documentation"
  | "cross-cutting";

export type FileKind = "production" | "test" | "fixture" | "documentation" | "reference" | "configuration";

export type FileRecord = {
  path: string;
  status: "A" | "M" | "D";
  area: Area;
  kind: FileKind;
  current: number;
  base: number;
  added: number;
  deleted: number;
};

export type Noun = {
  term: string;
  aka?: string;
  says: string;
  onDisk: string;
  not?: string;
};

export type Verb = {
  name: string;
  gesture: string;
  does: string;
  leaves: string;
  procedure: string;
};

export type Rule = {
  rule: string;
  because: string;
};

export type Refusal = {
  when: string;
  answer: string;
  where: string;
};

export type LifecycleStep = {
  index: string;
  title: string;
  person: string;
  client: string;
  server: string;
  rows: string;
};

export type SystematicChange = {
  index: string;
  title: string;
  before: string;
  now: string;
  why: string;
  area: Area;
};

export type Decision = {
  round: string;
  question: string;
  answer: string;
  became: string;
};

export type Verification = {
  check: string;
  command: string;
  result: string;
  clean: boolean;
};

export type OpenItem = {
  title: string;
  detail: string;
  recommendation: string;
};

export type ScopeTerm = {
  select: string;
  reads: string;
  picks: string;
  inABody: string;
  inADefault: string;
  inALiveResource: string;
};

export type ScopeDoor = {
  where: string;
  opens: string;
  title: string;
  confirms: string;
  writes: string;
};

export type ScopeWork = {
  path: string;
  status: "new" | "changed";
  area: Area;
  work: string;
};

export type ScopeFork = {
  index: string;
  question: string;
  recommended: string;
  because: string;
  alternative: string;
  cost: string;
};

export type ScopeGap = {
  title: string;
  detail: string;
  order: string;
};

/** One file that ever needed a decision when the two branches were replayed together. */
export type Reconciliation = {
  index: string;
  path: string;
  when: string;
  base: string;
  branch: string;
  kept: string;
  why: string;
};

/** Something that was actually broken, and what proves it is not any more. */
export type Defect = {
  index: string;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
  proof: string;
};

/** What each side of the meeting owns, layer by layer. */
export type Divergence = {
  layer: string;
  base: string;
  branch: string;
  meets: string;
};

/** One link in the chain from writing a prompt to reading a filled copy. */
export type ChainLink = {
  index: string;
  step: string;
  gesture: string;
  runs: string;
  state: "works" | "stub" | "missing";
  evidence: string;
};
