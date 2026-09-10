import { externalRelativePathWithin } from "$representation/data/behavior/external/file";
import { admitStoredExternalFile } from "$representation/data/behavior/external/stored-row";
import type { ExternalFile } from "$representation/store/tables";

/** Adds the configured path-size boundary to exact represented-row admission. */
export const admitExternalFileRow = (value: unknown, maxPathBytes: number): ExternalFile => {
  const row = admitStoredExternalFile(value);
  externalRelativePathWithin(row.relativePath, maxPathBytes);
  return row;
};
