export type DeliveryCommit = {
  readonly id: string;
  readonly title: string;
  readonly purpose: string;
};

export type DeliveryArea = {
  readonly id: string;
  readonly label: string;
  readonly files: number;
  readonly additions: number;
  readonly deletions: number;
  readonly outcome: string;
  readonly details: readonly string[];
};

export type DeliveredPanel = {
  readonly name: string;
  readonly surface: "Context" | "Inspector";
  readonly key: string;
  readonly reads: string;
  readonly presents: string;
  readonly behavior: string;
};

export type DeliveredCapability = {
  readonly name: string;
  readonly kind: "Query" | "Command";
  readonly input: string;
  readonly result: string;
  readonly guarantee: string;
};

export type VocabularyChange = {
  readonly component: string;
  readonly addition: string;
  readonly reason: string;
};

export type DeliveryFact = {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
};

export type DeltaFile = {
  readonly status: "New" | "Modified";
  readonly path: string;
};

export type DeltaGroup = {
  readonly id: string;
  readonly label: string;
  readonly summary: string;
  readonly additions: number;
  readonly deletions: number;
  readonly files: readonly DeltaFile[];
};
