import type {
  RejectedExternalFile,
  UploadedExternalFile,
  UploadExternalFileOutcome,
  UploadExternalFilesResult
} from "$capabilities/external-files/types/upload";

export const uploadedOutcome = (
  status: UploadedExternalFile["status"],
  row: {
    readonly _id: string;
    readonly name: string;
    readonly relativePath: string;
    readonly size: number;
    readonly mediaType: string;
    readonly subkind: UploadedExternalFile["subkind"];
    readonly revision: number;
  },
  semantic: UploadedExternalFile["semantic"]
): UploadedExternalFile => ({
  status,
  externalFileId: row._id,
  name: row.name,
  relativePath: row.relativePath,
  size: row.size,
  mediaType: row.mediaType,
  subkind: row.subkind,
  revision: row.revision,
  semantic
});

export const failureDetail = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const rejectUpload = (
  file: Pick<File, "name">,
  reason: RejectedExternalFile["reason"],
  detail: string,
  relativePath?: string
): RejectedExternalFile => ({
  status: "rejected",
  name: file.name,
  ...(relativePath === undefined ? {} : { relativePath }),
  reason,
  detail
});

export const summarizeUploadOutcomes = (
  outcomes: readonly UploadExternalFileOutcome[]
): UploadExternalFilesResult => ({
  outcomes,
  uploaded: outcomes.filter((entry) => entry.status === "uploaded").length,
  reused: outcomes.filter((entry) => entry.status === "reused").length,
  rejected: outcomes.filter((entry) => entry.status === "rejected").length
});
