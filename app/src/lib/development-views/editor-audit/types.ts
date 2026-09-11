export type DecisionKind = "Product decision" | "Working agreement";

export type DecisionCriterion = {
  readonly id: string;
  readonly label: string;
  readonly explanation: string;
};

export type DecisionOption = {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly tradeoffs: Readonly<Record<string, string>>;
};

export type DecisionBrief = {
  readonly id: string;
  readonly kind: DecisionKind;
  readonly question: string;
  readonly stakes: string;
  readonly context: readonly string[];
  readonly recommendation: {
    readonly optionId: string;
    readonly rationale: string;
  };
  readonly decision?: {
    readonly optionId: string;
    readonly direction: string;
    readonly recordedAt: string;
  };
  readonly criteria: readonly DecisionCriterion[];
  readonly options: readonly DecisionOption[];
};

export type Severity = "P0" | "P1" | "P2" | "P3";

export type FindingStatus =
  | "Fixed in this audit"
  | "Confirmed"
  | "Design recommendation"
  | "Coverage gap";

export type AuditArea =
  | "Creation and runtime"
  | "Document editor"
  | "Presentation editor"
  | "Across both editors"
  | "Quality system";

export type Finding = {
  readonly id: string;
  readonly area: AuditArea;
  readonly severity: Severity;
  readonly status: FindingStatus;
  readonly title: string;
  readonly symptom: string;
  readonly cause: string;
  readonly fix: string;
  readonly acceptance: string;
  readonly evidence: readonly string[];
};

export type RemediationPhase = {
  readonly name: string;
  readonly tone: "fixed" | "urgent" | "planned";
  readonly items: readonly string[];
};
