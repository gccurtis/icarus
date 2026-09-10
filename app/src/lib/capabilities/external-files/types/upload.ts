import type { FileSubkind } from "$representation/data/types/external/file";

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
  readonly semantic: "queued" | "unsupported";
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
