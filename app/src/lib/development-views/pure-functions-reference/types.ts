export type ReferencePage = "configuration" | "system";

export type SourceRecord = {
  readonly path: string;
  readonly label: string;
  readonly role: string;
  readonly source: string;
  readonly open: boolean;
};

export type CheckerRecord = {
  readonly id: string;
  readonly checker: string;
  readonly guarantee: string;
  readonly proof: string;
  readonly area: "Boundary" | "Capability" | "Component" | "Model" | "Runtime" | "Tooling";
};
