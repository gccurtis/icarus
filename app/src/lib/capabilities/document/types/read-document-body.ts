import type { DocumentBody } from "$representation/data/types/documents/body";

export type ReadDocumentBodyInput = {
  readonly resourceId: string;
};

/** `null` rather than `undefined`: a remote function's answer is JSON. */
export type ReadDocumentBodyResult = {
  readonly revision: number;
  readonly body: DocumentBody;
} | null;
