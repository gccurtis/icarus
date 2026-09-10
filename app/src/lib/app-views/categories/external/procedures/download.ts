export const externalFileDownloadHref = (
  projectToken: string,
  externalFileId: string
): string => `/app/${encodeURIComponent(projectToken)}/external-files/${encodeURIComponent(externalFileId)}`;
