import { asId } from "$representation/data/behavior/core/id";
import {
  externalDirectoryContains,
  normalizeExternalRelativePath
} from "$representation/data/behavior/external/file";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalDirectoriesIn } from "$capabilities/external-files/api/shared/directories";
import { recordExternalFileHistory } from "$capabilities/external-files/api/shared/history";
import { externalFilesIn, rowsOf } from "$capabilities/external-files/api/shared/rows";
import { validateRelocateExternalDirectory } from "$capabilities/external-files/api/relocate-external-directory/validate-relocate-external-directory";
import type { RelocateExternalDirectoryResult } from "$capabilities/external-files/types/external-files";

export const relocateExternalDirectory = async (
  input: unknown
): Promise<RelocateExternalDirectoryResult> => {
  const scope = await requireScope();
  const asked = validateRelocateExternalDirectory(input);
  if (
    asked.path === "" ||
    asked.destination === "" ||
    asked.destination === asked.path ||
    asked.destination.startsWith(`${asked.path}/`)
  ) return {
    accepted: false,
    path: asked.path,
    reason: "invalid-destination",
    detail: "A directory destination must be a different non-root path outside itself."
  };

  const model = serverModel();
  const release = await model.externalFileStorage.acquireMutation();
  try {
    const admitted = externalFilesIn(model, scope).files;
    const directory = externalDirectoriesIn(admitted).find((entry) => entry.path === asked.path);
    if (directory === undefined || directory.descendantFileCount === 0) return {
      accepted: false,
      path: asked.path,
      reason: "not-found",
      detail: "That virtual directory no longer contains project files."
    };
    if (directory.revisionToken !== asked.baseRevisionToken) return {
      accepted: false,
      path: asked.path,
      reason: "stale",
      detail: "Files in that directory changed. Refresh before moving it."
    };
    const members = admitted.filter(({ item }) =>
      externalDirectoryContains(asked.path, item.relativePath)
    );
    const memberIds = new Set(members.map(({ row }) => row._id));
    const destinations = members.map(({ item }) => normalizeExternalRelativePath(
      `${asked.destination}/${item.relativePath.slice(asked.path.length + 1)}`
    ));
    const duplicate = destinations.find((path, index) => destinations.indexOf(path) !== index);
    const heldPaths = new Set(rowsOf(model.store, "externalFiles").flatMap((row) => {
      if (row.projectId !== scope.projectId || memberIds.has(row._id)) return [];
      try {
        return [normalizeExternalRelativePath(row.relativePath ?? row.originalName ?? row.name)];
      } catch {
        return [];
      }
    }));
    if (duplicate !== undefined || destinations.some((path) => heldPaths.has(path))) return {
      accepted: false,
      path: asked.path,
      reason: "path-conflict",
      detail: "The destination would collide with another project file."
    };

    const at = Date.now();
    const actor = { kind: "user" as const, userId: asId<"users">(scope.userId) };
    model.store.replaceRows("externalFiles", members.map(({ row, item }, index) => {
      const { _id, _creationTime, ...held } = row;
      void _id;
      void _creationTime;
      return {
        id: row._id,
        fields: {
          ...held,
          relativePath: destinations[index],
          updatedBy: actor,
          revision: item.revision + 1,
          updatedAt: at
        }
      };
    }));
    members.forEach(({ row, item }, index) => recordExternalFileHistory(model, scope, {
      event: "moved",
      externalFileId: row._id,
      name: item.name,
      relativePath: destinations[index],
      detail: `${item.relativePath} → ${destinations[index]}`
    }));
    return {
      accepted: true,
      path: asked.path,
      destination: asked.destination,
      movedFiles: members.length,
      externalFileIds: members.map(({ row }) => row._id)
    };
  } finally {
    release();
  }
};
