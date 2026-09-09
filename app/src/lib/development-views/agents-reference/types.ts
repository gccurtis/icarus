export type PageSlug =
  | "overview"
  | "context"
  | "inspector"
  | "library"
  | "persona"
  | "task"
  | "automation"
  | "backend"
  | "rebase"
  | "intelligence"
  | "explore"
  | "response"
  | "personas"
  | "tasks"
  | "automations"
  | "research-chat"
  | "second-rebase";

export type PageRecord = {
  readonly slug: PageSlug;
  readonly index: string;
  readonly label: string;
  readonly path: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly lede: string;
  readonly readout: readonly { readonly label: string; readonly value: string }[];
};

export type Callout = {
  readonly n: number;
  readonly title: string;
  readonly body: string;
};

export type Question = {
  readonly n: number;
  readonly page: PageSlug;
  readonly title: string;
  readonly matters: string;
  readonly options: readonly string[];
  readonly recommendation: string;
};

export type FileStatus = "create" | "modify" | "delete";

export type Area =
  | "representation"
  | "seed"
  | "capability"
  | "components"
  | "views"
  | "shell"
  | "docs";

export type PlannedFile = {
  readonly path: string;
  readonly status: FileStatus;
  readonly area: Area;
  readonly phase: number;
  readonly purpose: string;
};

export type Phase = {
  readonly n: number;
  readonly title: string;
  readonly produces: string;
  readonly proves: string;
};

export type ChainField = {
  readonly name: string;
  readonly type: string;
  readonly note?: string;
};

export type ChainStep = {
  readonly does: string;
  /** The function this step calls, written as it is called in the source. */
  readonly calls?: string;
  /** The row or field this step changes, when it changes one. */
  readonly writes?: string;
};

/**
 * One procedure, end to end: what it takes, what it does, what it answers.
 *
 * The unit a reader has to hold to follow a system, and the one thing a table
 * of procedures cannot show.
 */
export type Chain = {
  readonly name: string;
  readonly kind: "query" | "command" | "internal";
  readonly file: string;
  readonly input: readonly ChainField[];
  readonly output: readonly ChainField[];
  readonly steps: readonly ChainStep[];
  readonly refuses: readonly { readonly reason: string; readonly when: string }[];
  readonly refreshes: readonly string[];
};

export type Note = {
  readonly at: string;
  readonly page: string;
  readonly id: string;
  readonly label: string;
  readonly text: string;
};
