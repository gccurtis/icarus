/**
 * Prose-text extensions — files with these extensions are classified as
 * "general::file::text" and admitted to the Knowledge lattice.
 *
 * Standalone copy owned by this capability. Not imported from any other
 * capability — lists may intentionally diverge.
 */
export const PROSE_TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "rst", "org", "tex",
  "html", "htm",
  "log",
  "docx",
  "pdf",
]);

export type GeneralFileKind = "general::file::text" | "general::file::other";

export function kindFromExtension(ext: string): GeneralFileKind {
  return PROSE_TEXT_EXTENSIONS.has(ext) ? "general::file::text" : "general::file::other";
}

export interface GeneralFile {
  /** Content-addressed: SHA-256(content), hex-encoded. */
  readonly id: string;
  readonly kind: GeneralFileKind;
  /** Original filename at upload time. */
  readonly fileName: string;
  /** Detected extension, lowercased. */
  readonly extension: string;
  /** Full content. Text-kind: UTF-8. Other-kind: raw bytes as base64. */
  readonly content: string;
  /** Byte length of content. */
  readonly byteSize: number;
  /** SHA-256 of content. Matches id. */
  readonly contentHash: string;
  /** Revision counter. Incremented on update. Starts at 1. */
  readonly revision: number;
  /** Knowledge source ID (text-kind only; null for other-kind). */
  readonly knowledgeSourceId: string | null;
  /** When this file replaced another, the previous file's ID. */
  readonly replacesId?: string;
  /** When this file was replaced, the new file's ID. */
  readonly replacedById?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}

export interface GeneralFileUploadRequest {
  fileName: string;
  content: string; // text-kind: UTF-8; other-kind: base64
}

export interface GeneralFileUpdateRequest {
  content: string;
}

export type GeneralFileUploadResult =
  | { kind: "created"; file: GeneralFile; knowledge?: import("#platform/knowledge/types.js").AddResult }
  | { kind: "reused"; file: GeneralFile; message: "identical content already exists" };

export type GeneralFileUpdateResult =
  | { kind: "updated"; file: GeneralFile; knowledge?: import("#platform/knowledge/types.js").AddResult }
  | { kind: "unchanged"; file: GeneralFile; message: "new content identical to current" };

// -- Search / filter support --

export type GeneralFileFilter =
  | { kind: "by-kind"; value: GeneralFileKind }
  | { kind: "by-extension"; value: string }
  | { kind: "by-name-contains"; value: string }
  | { kind: "by-name-starts-with"; value: string }
  | { kind: "by-name-ends-with"; value: string };

export interface GeneralFilesListRequest {
  /** Optional filters. If empty, returns all files. */
  filters?: GeneralFileFilter[];
}