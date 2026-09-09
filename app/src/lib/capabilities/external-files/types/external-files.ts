import type { FileSubkind } from "$representation/data/types/external/file";
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

export type ExternalFileLibraryItem = {
  readonly id: string;
  readonly name: string;
  readonly originalName: string;
  readonly relativePath: string;
  readonly mediaType: string;
  readonly subkind: FileSubkind;
  readonly size: number | null;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly createdByName: string;
  readonly updatedByName: string;
  readonly origin: ExternalFileOriginView;
  readonly semantic: ExternalFileSemanticStatus;
};

export type ExternalFileUnavailable = {
  readonly unavailable: true;
  readonly externalFileId: string;
  readonly reason: "corrupt";
  readonly detail: string;
};

export type ReadExternalFileLibraryResult = {
  readonly files: readonly ExternalFileLibraryItem[];
  readonly unavailable: readonly ExternalFileUnavailable[];
  readonly limits: ExternalFilesLimits;
};

export type ExternalFileUsageKind =
  | "document"
  | "slide-deck"
  | "template"
  | "resource-set"
  | "finding";

export type ExternalFileUsageItem = {
  readonly kind: ExternalFileUsageKind;
  readonly id: string;
  readonly name: string;
};

export type ExternalFileUsage = {
  readonly total: number;
  readonly items: readonly ExternalFileUsageItem[];
};

export type ExternalFileNativeState =
  | { readonly state: "available"; readonly size: number }
  | { readonly state: "missing" }
  | { readonly state: "corrupt"; readonly detail: string };

export type ExternalFileDetail = ExternalFileLibraryItem & {
  readonly hash: string;
  readonly native: ExternalFileNativeState;
  readonly usage: ExternalFileUsage;
};

export type ReadExternalFileInput = { readonly externalFileId: string };
export type ReadExternalFileResult = ExternalFileDetail | ExternalFileUnavailable | null;

export type UploadExternalFilesInput = {
  /** Injected by `RemoteForm.for` to keep file and folder pickers independent. */
  readonly id: "files" | "folder";
  readonly files: File[];
  readonly relativePaths?: string[];
};

export type UploadExternalFileRejection =
  | "empty"
  | "too-many-files"
  | "file-too-large"
  | "batch-too-large"
  | "invalid-path"
  | "duplicate-path"
  | "path-conflict"
  | "read-failed"
  | "storage-failed"
  | "store-failed";

export type UploadedExternalFile = {
  readonly status: "uploaded" | "reused";
  readonly externalFileId: string;
  readonly name: string;
  readonly relativePath: string;
  readonly size: number;
  readonly mediaType: string;
  readonly subkind: FileSubkind;
  readonly revision: number;
  readonly semantic: "queued" | "unsupported" | "enqueue-failed";
  readonly semanticDetail?: string;
};

export type RejectedExternalFile = {
  readonly status: "rejected";
  readonly name: string;
  readonly relativePath?: string;
  readonly reason: UploadExternalFileRejection;
  readonly detail: string;
};

export type UploadExternalFileOutcome = UploadedExternalFile | RejectedExternalFile;

export type UploadExternalFilesResult = {
  readonly outcomes: readonly UploadExternalFileOutcome[];
  readonly uploaded: number;
  readonly reused: number;
  readonly rejected: number;
};

export type RenameExternalFileInput = {
  readonly externalFileId: string;
  readonly baseRevision: number;
  readonly name: string;
};

export type RenameExternalFileResult =
  | {
      readonly accepted: true;
      readonly externalFileId: string;
      readonly revision: number;
      readonly semantic: "queued" | "unsupported" | "enqueue-failed";
      readonly semanticDetail?: string;
    }
  | {
      readonly accepted: false;
      readonly externalFileId: string;
      readonly reason: "not-found" | "stale" | "corrupt";
      readonly revision: number | null;
      readonly detail: string;
    };

export type RemoveExternalFileInput = {
  readonly externalFileId: string;
  readonly baseRevision: number;
};

export type RemoveExternalFileResult =
  | {
      readonly accepted: true;
      readonly externalFileId: string;
      readonly revision: number;
      readonly blob: "removed" | "shared" | "already-missing" | "retained-after-error";
      readonly blobDetail?: string;
    }
  | {
      readonly accepted: false;
      readonly externalFileId: string;
      readonly reason: "not-found" | "stale" | "corrupt" | "in-use" | "cleanup-failed";
      readonly revision: number | null;
      readonly detail: string;
      readonly usage?: ExternalFileUsage;
    };

export type ReadExternalFileContentInput = { readonly externalFileId: string };
export type ReadExternalFileContentResult = {
  readonly externalFileId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly hash: string;
  readonly bytes: Uint8Array;
} | null;
