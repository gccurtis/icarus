export type ReferenceSlug = "overview" | "ingestion" | "stable-tab" | "file-plan" | "implementation" | "integration";

export type ImplementationState = "exists" | "extend" | "create" | "defer";

export type ImplementationFile = {
  path: string;
  action: "created" | "modified" | "generated" | "removed";
  layer: "configuration" | "model" | "representation" | "capability" | "semantic" | "workspace" | "transport" | "reference" | "verification";
  owner: string;
  reason: string;
};

export type FormatContract = {
  family: string;
  examples: string;
  classification: string;
  content: string;
  exactLane: string;
  materialLane: string;
  v1: "complete" | "partial" | "stored";
  caution: string;
};
