export type RebasePageSlug = "overview" | "replay" | "checkers" | "runbook";

export type RebasePage = {
  slug: RebasePageSlug;
  index: string;
  label: string;
  eyebrow: string;
  title: string;
  lede: string;
};

export type ReplayCommit = {
  hash: string;
  subject: string;
  phase: "foundation" | "editor" | "templates" | "agents";
  stops?: boolean;
};

export type ConflictCluster = {
  stop: number;
  commit: string;
  subject: string;
  files: string[];
  collision: string;
  resolution: string;
  proof: string;
  risk: "low" | "medium" | "high";
};

export type FindingGroup = {
  title: string;
  count: number;
  files: string[];
  cause: string;
  repair: string;
  verification: string;
};

export type RunbookPhase = {
  id: string;
  title: string;
  intent: string;
  actions: string[];
  files: string[];
  gates: string[];
  rollback: string;
};
