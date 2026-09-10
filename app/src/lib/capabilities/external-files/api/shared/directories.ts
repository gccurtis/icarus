import { createHash } from "node:crypto";

import {
  externalDirectoryContains,
  externalDirectoryIn,
  externalDirectoryNameIn,
  externalDirectoryParentIn
} from "$representation/data/behavior/external/file";
import type { AdmittedExternalFile } from "$capabilities/external-files/api/shared/rows";
import type {
  ExternalDirectoryItem,
  ExternalFileLibraryItem
} from "$capabilities/external-files/types/external-files";

export const externalDirectoryRevisionToken = (
  files: readonly {
    readonly item: Pick<ExternalFileLibraryItem, "id" | "revision" | "relativePath">;
  }[]
): string => {
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
  return [...paths].sort((left, right) => left.localeCompare(right)).map((relativePath) => {
    const descendants = files.filter(({ item }) =>
      externalDirectoryContains(relativePath, item.relativePath)
    );
    const direct = descendants.filter(
      ({ item }) => externalDirectoryIn(item.relativePath) === relativePath
    );
    const directDirectories = [...paths].filter(
      (candidate) =>
        candidate !== relativePath && externalDirectoryParentIn(candidate) === relativePath
    );
    return {
      relativePath,
      name: externalDirectoryNameIn(relativePath),
      parentPath: externalDirectoryParentIn(relativePath),
      directFileCount: direct.length,
      descendantFileCount: descendants.length,
      directDirectoryCount: directDirectories.length,
      knownBytes: descendants.reduce((total, file) => total + file.item.size, 0),
      revisionToken: externalDirectoryRevisionToken(descendants)
    };
  });
};
