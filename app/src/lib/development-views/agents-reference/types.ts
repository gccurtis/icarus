export type PageSlug =
  | "overview"
  | "context"
  | "inspector"
  | "library"
  | "persona"
  | "task"
  | "automation"
  | "backend";

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

export type Note = {
  readonly at: string;
  readonly page: string;
  readonly id: string;
  readonly label: string;
  readonly text: string;
};
