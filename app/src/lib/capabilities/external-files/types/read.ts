import type { FileSubkind } from "$representation/data/types/external/file";
import type {
  ExternalFileOriginView,
  ExternalFileSemanticStatus,
  ExternalFilesLimits
} from "$capabilities/external-files/types/shared";

export type ExternalFileLibraryItem = {
  readonly id: string;
  readonly name: string;
  readonly originalName: string;
  readonly relativePath: string;
  readonly mediaType: string;
  readonly subkind: FileSubkind;
  readonly size: number;
  readonly revision: number;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly createdByName: string;
  readonly updatedByName: string;
  readonly origin: ExternalFileOriginView;
  readonly semanticContext?: string;
  readonly semantic: ExternalFileSemanticStatus;
};

export type ExternalDirectoryItem = {
  /** Empty string is the virtual project root. */
  readonly relativePath: string;
  readonly name: string;
  readonly parentPath: string | null;
  readonly directFileCount: number;
  readonly descendantFileCount: number;
  readonly directDirectoryCount: number;
  readonly knownBytes: number;
  /** Opaque compare-and-swap token over descendant ids, revisions, and paths. */
  readonly revisionToken: string;
};

export type ExternalFileUnavailable = {
  readonly unavailable: true;
  readonly externalFileId: string;
  readonly reason: "corrupt";
  readonly detail: string;
};

export type ReadExternalFileLibraryResult = {
  readonly files: readonly ExternalFileLibraryItem[];
  readonly directories: readonly ExternalDirectoryItem[];
  readonly unavailable: readonly ExternalFileUnavailable[];
  readonly limits: ExternalFilesLimits;
};

export type ExternalFileHistoryEvent =
  | "uploaded"
  | "re-uploaded"
  | "renamed"
  | "moved"
  | "deleted"
  | "context-updated";

export type ExternalFileHistoryEntry = {
  readonly id: string;
  readonly externalFileId: string;
  readonly event: ExternalFileHistoryEvent;
  readonly name: string;
  readonly relativePath: string;
  readonly actorName: string;
  readonly at: number;
  readonly detail?: string;
};

export type ReadExternalFileHistoryResult = {
  readonly entries: readonly ExternalFileHistoryEntry[];
};

export type ExternalFileUsageKind =
  | "document"
  | "presentation"
  | "spreadsheet"
  | "template"
  | "resource-set"
  | "finding"
  | "question"
  | "hypothesis"
  | "comment"
  | "research"
  | "thread"
  | "persona"
  | "agent-task"
  | "automation"
  | "derived-output"
  | "variable"
  | "formula";

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
