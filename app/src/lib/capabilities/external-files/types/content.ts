export type ReadExternalFileContentInput = { readonly externalFileId: string };

export type ReadExternalFileContentResult = {
  readonly externalFileId: string;
  readonly name: string;
  readonly mediaType: string;
  readonly hash: string;
  readonly bytes: Uint8Array;
} | null;
