import { command, form, query } from "$app/server";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

import { readExternalFile as readExternalFileProcedure } from "$capabilities/external-files/api/read-external-file/read-external-file";
import { readExternalFileLibrary as readExternalFileLibraryProcedure } from "$capabilities/external-files/api/read-external-file-library/read-external-file-library";
import { removeExternalFile as removeExternalFileProcedure } from "$capabilities/external-files/api/remove-external-file/remove-external-file";
import { renameExternalFile as renameExternalFileProcedure } from "$capabilities/external-files/api/rename-external-file/rename-external-file";
import { uploadExternalFiles as uploadExternalFilesProcedure } from "$capabilities/external-files/api/upload-external-files/upload-external-files";

export const readExternalFileLibrary = query(readExternalFileLibraryProcedure);
export const readExternalFile = query("unchecked", readExternalFileProcedure);

export const uploadExternalFiles = form("unchecked", async (input) => {
  const result = await uploadExternalFilesProcedure(input);
  await readExternalFileLibrary().refresh();
  await readProjectResourceIndex().refresh();
  return result;
});

export const renameExternalFile = command("unchecked", async (input) => {
  const result = await renameExternalFileProcedure(input);
  await readExternalFileLibrary().refresh();
  await readProjectResourceIndex().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export const removeExternalFile = command("unchecked", async (input) => {
  const result = await removeExternalFileProcedure(input);
  await readExternalFileLibrary().refresh();
  await readProjectResourceIndex().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export type {
  ExternalFileDetail,
  ExternalFileLibraryItem,
  ExternalFileNativeState,
  ExternalFileOriginView,
  ExternalFileSemanticStatus,
  ExternalFilesLimits,
  ExternalFileUnavailable,
  ExternalFileUsage,
  ExternalFileUsageItem,
  ExternalFileUsageKind,
  ReadExternalFileInput,
  ReadExternalFileLibraryResult,
  ReadExternalFileResult,
  RejectedExternalFile,
  RemoveExternalFileInput,
  RemoveExternalFileResult,
  RenameExternalFileInput,
  RenameExternalFileResult,
  UploadedExternalFile,
  UploadExternalFileOutcome,
  UploadExternalFileRejection,
  UploadExternalFilesInput,
  UploadExternalFilesResult
} from "$capabilities/external-files/types/external-files";
