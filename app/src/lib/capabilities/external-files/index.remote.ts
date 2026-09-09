import { command, form, query } from "$app/server";
import { readProjectResourceIndex } from "$capabilities/project-resources/index.remote";

import { readExternalFile as readExternalFileProcedure } from "$capabilities/external-files/api/read-external-file/read-external-file";
import { readExternalFileHistory as readExternalFileHistoryProcedure } from "$capabilities/external-files/api/read-external-file-history/read-external-file-history";
import { readExternalFileLibrary as readExternalFileLibraryProcedure } from "$capabilities/external-files/api/read-external-file-library/read-external-file-library";
import { relocateExternalDirectory as relocateExternalDirectoryProcedure } from "$capabilities/external-files/api/relocate-external-directory/relocate-external-directory";
import { relocateExternalFile as relocateExternalFileProcedure } from "$capabilities/external-files/api/relocate-external-file/relocate-external-file";
import { removeExternalFile as removeExternalFileProcedure } from "$capabilities/external-files/api/remove-external-file/remove-external-file";
import { renameExternalFile as renameExternalFileProcedure } from "$capabilities/external-files/api/rename-external-file/rename-external-file";
import { reuploadExternalFile as reuploadExternalFileProcedure } from "$capabilities/external-files/api/reupload-external-file/reupload-external-file";
import { updateExternalFileContext as updateExternalFileContextProcedure } from "$capabilities/external-files/api/update-external-file-context/update-external-file-context";
import { uploadExternalFiles as uploadExternalFilesProcedure } from "$capabilities/external-files/api/upload-external-files/upload-external-files";

export const readExternalFileLibrary = query(readExternalFileLibraryProcedure);
export const readExternalFile = query("unchecked", readExternalFileProcedure);
export const readExternalFileHistory = query(readExternalFileHistoryProcedure);

export const uploadExternalFiles = form("unchecked", async (input) => {
  const result = await uploadExternalFilesProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readProjectResourceIndex().refresh();
  return result;
});

export const reuploadExternalFile = form("unchecked", async (input) => {
  const result = await reuploadExternalFileProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readProjectResourceIndex().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export const renameExternalFile = command("unchecked", async (input) => {
  const result = await renameExternalFileProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readProjectResourceIndex().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export const relocateExternalFile = command("unchecked", async (input) => {
  const result = await relocateExternalFileProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readProjectResourceIndex().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export const relocateExternalDirectory = command("unchecked", async (input) => {
  const result = await relocateExternalDirectoryProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readProjectResourceIndex().refresh();
  if (result.accepted) {
    await Promise.all(result.externalFileIds.map((externalFileId) =>
      readExternalFile({ externalFileId }).refresh()
    ));
  }
  return result;
});

export const updateExternalFileContext = command("unchecked", async (input) => {
  const result = await updateExternalFileContextProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export const removeExternalFile = command("unchecked", async (input) => {
  const result = await removeExternalFileProcedure(input);
  await readExternalFileLibrary().refresh();
  await readExternalFileHistory().refresh();
  await readProjectResourceIndex().refresh();
  await readExternalFile({ externalFileId: result.externalFileId }).refresh();
  return result;
});

export type {
  ExternalFileDetail,
  ExternalDirectoryItem,
  ExternalFileHistoryEntry,
  ExternalFileHistoryEvent,
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
  ReadExternalFileHistoryResult,
  ReadExternalFileLibraryResult,
  ReadExternalFileResult,
  RejectedExternalFile,
  RemoveExternalFileInput,
  RemoveExternalFileResult,
  RelocateExternalDirectoryInput,
  RelocateExternalDirectoryResult,
  RelocateExternalFileInput,
  RelocateExternalFileResult,
  ReuploadExternalFileInput,
  ReuploadExternalFileResult,
  RenameExternalFileInput,
  RenameExternalFileResult,
  UploadedExternalFile,
  UploadExternalFileOutcome,
  UploadExternalFileRejection,
  UploadExternalFilesInput,
  UploadExternalFilesResult,
  UpdateExternalFileContextInput,
  UpdateExternalFileContextResult
} from "$capabilities/external-files/types/external-files";
