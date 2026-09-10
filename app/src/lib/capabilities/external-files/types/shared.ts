import type { ReadSemanticStatusResult } from "$capabilities/semantic-overlay";

export type ExternalFilesLimits = {
  readonly maxFiles: number;
  readonly maxFileBytes: number;
  readonly maxBatchBytes: number;
  readonly maxPathBytes: number;
  readonly maxResponseBytes: number;
};

export type ExternalFileSemanticStatus = Exclude<ReadSemanticStatusResult, null>;

export type ExternalFileOriginView =
  | { readonly kind: "upload"; readonly label: "Uploaded" }
  | {
      readonly kind: "connector";
      readonly label: "Connector";
      readonly connectorId: string;
      readonly sourceId: string;
    };
