import { readExternalFile } from "$capabilities/external-files/index.remote";

export const externalFileDetail = (externalFileId: string | undefined) =>
  externalFileId === undefined ? undefined : readExternalFile({ externalFileId });
