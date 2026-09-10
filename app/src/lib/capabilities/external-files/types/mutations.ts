import type { FileSubkind } from "$representation/data/types/external/file";
import type { ExternalFileUsage } from "$capabilities/external-files/types/read";

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
      readonly relativePath: string;
      readonly semantic: "queued" | "unsupported";
      readonly semanticDetail?: string;
    }
  | {
      readonly accepted: false;
      readonly externalFileId: string;
      readonly reason:
        | "not-found"
        | "stale"
        | "corrupt"
        | "invalid-path"
        | "path-conflict"
        | "store-failed";
      readonly revision: number | null;
      readonly detail: string;
    };

export type RelocateExternalFileInput = {
  readonly externalFileId: string;
  readonly baseRevision: number;
  /** Virtual destination directory; the existing file name is preserved. */
  readonly destinationDirectory: string;
};

export type RelocateExternalFileResult = RenameExternalFileResult;

export type RelocateExternalDirectoryInput = {
  readonly sourceDirectory: string;
  readonly destinationDirectory: string;
  readonly baseRevisionToken: string;
};

export type RelocateExternalDirectoryResult =
  | {
      readonly accepted: true;
      readonly sourceDirectory: string;
      readonly destinationDirectory: string;
      readonly movedFiles: number;
      readonly externalFileIds: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly sourceDirectory: string;
      readonly reason:
        | "not-found"
        | "stale"
        | "corrupt"
        | "path-conflict"
        | "invalid-destination"
        | "store-failed";
      readonly detail: string;
    };

export type ReuploadExternalFileInput = {
  readonly id: "reupload";
  readonly externalFileId: string;
  readonly baseRevision: number;
  readonly file: File;
};

export type ReuploadExternalFileResult =
  | {
      readonly accepted: true;
      readonly externalFileId: string;
      readonly revision: number;
      readonly size: number;
      readonly mediaType: string;
      readonly subkind: FileSubkind;
      readonly semantic: "queued" | "unsupported";
      readonly semanticDetail?: string;
      readonly previousBlob: "removed" | "shared" | "already-missing" | "retained-after-error";
    }
  | {
      readonly accepted: false;
      readonly externalFileId: string;
      readonly reason: "not-found" | "stale" | "corrupt" | "file-too-large" | "read-failed" | "storage-failed" | "cleanup-failed" | "store-failed";
      readonly revision: number | null;
      readonly detail: string;
    };

export type UpdateExternalFileContextInput = {
  readonly externalFileId: string;
  readonly baseRevision: number;
  readonly semanticContext: string;
};

export type UpdateExternalFileContextResult =
  | {
      readonly accepted: true;
      readonly externalFileId: string;
      readonly revision: number;
      readonly semantic: "queued" | "unsupported";
      readonly semanticDetail?: string;
    }
  | {
      readonly accepted: false;
      readonly externalFileId: string;
      readonly reason: "not-found" | "stale" | "corrupt" | "wrong-kind" | "store-failed";
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
      readonly reason: "not-found" | "stale" | "corrupt" | "in-use" | "store-failed";
      readonly revision: number | null;
      readonly detail: string;
      readonly usage?: ExternalFileUsage;
    };
