export type AuditGrade = "Strong" | "Partial" | "Weak" | "Critical";
export type AuditPriority = "P0" | "P1" | "P2";

export type AuditMetric = {
  readonly value: string;
  readonly label: string;
  readonly detail: string;
  readonly tone?: "positive" | "attention" | "danger";
};

export type ScorecardRow = {
  readonly concern: string;
  readonly grade: AuditGrade;
  readonly assessment: string;
  readonly evidence: string;
};

export type StateOwnerRow = {
  readonly state: string;
  readonly intendedOwner: string;
  readonly asBuilt: string;
  readonly grade: AuditGrade;
};

export type AuditFinding = {
  readonly id: string;
  readonly priority: AuditPriority;
  readonly area: string;
  readonly title: string;
  readonly finding: string;
  readonly consequence: string;
  readonly recommendation: string;
  readonly acceptance: string;
  readonly evidence: readonly string[];
};

export type FindingGroup = {
  readonly area: string;
  readonly summary: string;
  readonly findings: readonly AuditFinding[];
};

export type Hotspot = {
  readonly path: string;
  readonly lines: string;
  readonly concern: string;
  readonly split: string;
};

export type Guardrail = {
  readonly name: string;
  readonly catches: string;
  readonly rule: string;
};

export type RemediationPhase = {
  readonly phase: string;
  readonly objective: string;
  readonly changes: readonly string[];
};

export type Strength = {
  readonly title: string;
  readonly description: string;
  readonly evidence: string;
};
