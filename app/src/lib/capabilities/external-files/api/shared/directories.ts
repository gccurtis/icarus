import { createHash } from "node:crypto";

import {
  externalDirectoryContains,
  externalDirectoryIn,
  externalDirectoryNameIn,
  externalDirectoryParentIn
} from "$representation/data/behavior/external/file";
import type { AdmittedExternalFile } from "$capabilities/external-files/api/shared/rows";
import type { ExternalDirectoryItem } from "$capabilities/external-files/types/external-files";

const tokenFor = (files: readonly AdmittedExternalFile[]): string => {
  const identity = files
    .map(({ item }) => `${item.id}\u0000${item.revision}\u0000${item.relativePath}`)
    .sort()
    .join("\u0001");
  return createHash("sha256").update(identity).digest("hex");
};

/** Projects virtual directories from canonical file paths; no folder row is stored. */
export const externalDirectoriesIn = (
  files: readonly AdmittedExternalFile[]
): readonly ExternalDirectoryItem[] => {
  const paths = new Set<string>([""]);
  for (const { item } of files) {
    const segments = externalDirectoryIn(item.relativePath).split("/").filter(Boolean);
    for (let depth = 1; depth <= segments.length; depth += 1) {
      paths.add(segments.slice(0, depth).join("/"));
    }
  }
  return [...paths].sort((left, right) => left.localeCompare(right)).map((path) => {
    const descendants = files.filter(({ item }) =>
      externalDirectoryContains(path, item.relativePath)
    );
    const direct = descendants.filter(({ item }) => externalDirectoryIn(item.relativePath) === path);
    const directDirectories = [...paths].filter(
      (candidate) => candidate !== path && externalDirectoryParentIn(candidate) === path
    );
    return {
      path,
      name: externalDirectoryNameIn(path),
      parentPath: externalDirectoryParentIn(path),
      directFileCount: direct.length,
      descendantFileCount: descendants.length,
      directDirectoryCount: directDirectories.length,
      knownBytes: descendants.reduce((total, file) => total + (file.item.size ?? 0), 0),
      unknownSizeCount: descendants.filter((file) => file.item.size === null).length,
      revisionToken: tokenFor(descendants)
    };
  });
};
