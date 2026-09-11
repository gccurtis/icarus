export type InvestigationStatus = "resolved" | "direction" | "bounded";

export type Evidence = {
  readonly path: string;
  readonly finding: string;
  readonly href?: string;
};

export type Alternative = {
  readonly option: string;
  readonly benefit: string;
  readonly cost: string;
  readonly decision: "recommend" | "reject" | "later";
};

export type ContractRow = {
  readonly concern: string;
  readonly decision: string;
};

export type Investigation = {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly prompt: string;
  readonly status: InvestigationStatus;
  readonly verdict: string;
  readonly answer: string;
  readonly observed: readonly string[];
  readonly contract: readonly ContractRow[];
  readonly alternatives: readonly Alternative[];
  readonly sequence: readonly string[];
  readonly acceptance: readonly string[];
  readonly evidence: readonly Evidence[];
};

export type ReviewDecision = {
  readonly id: string;
  readonly title: string;
  readonly context: string;
  readonly recommendation: string;
  readonly effect: string;
};

export type Principle = {
  readonly label: string;
  readonly statement: string;
};
