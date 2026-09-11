import {
  externalDirectoryContains,
  externalPathSetHasConflicts,
  externalRelativePathWithin
} from "$representation/data/behavior/external/file";
import { admitExternalFileRow } from "$representation/data/behavior/external/row";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { recordExternalFileActivity } from "$capabilities/activity";
import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import { externalDirectoryRevisionToken } from "$capabilities/external-files/api/shared/directories";
import { replaceExternalFileIn } from "$capabilities/external-files/api/shared/mutations";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import { validateRelocateExternalDirectory } from "$capabilities/external-files/api/relocate-external-directory/validate-relocate-external-directory";
import type { RelocateExternalDirectoryResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const relocateExternalDirectory = async (
  input: unknown
): Promise<RelocateExternalDirectoryResult> => {
  const scope = await requireScope();
  const asked = validateRelocateExternalDirectory(input);
  if (
    asked.sourceDirectory === "" ||
    asked.destinationDirectory === "" ||
    asked.destinationDirectory === asked.sourceDirectory ||
    asked.destinationDirectory.startsWith(`${asked.sourceDirectory}/`)
  ) return {
    accepted: false,
    sourceDirectory: asked.sourceDirectory,
    reason: "invalid-destination",
    detail: "A directory destination must be a different non-root path outside itself."
  };

  const model = serverModel();
  const limits = externalFilesLimits(model.configuration);
  try {
    externalRelativePathWithin(asked.sourceDirectory, limits.maxPathBytes);
    externalRelativePathWithin(asked.destinationDirectory, limits.maxPathBytes);
  } catch (error) {
    return {
      accepted: false,
      sourceDirectory: asked.sourceDirectory,
      reason: "invalid-destination",
      detail: failure(error)
    };
  }
  try {
    return model.store.transaction((unit): RelocateExternalDirectoryResult => {
      let projectRows;
      try {
        projectRows = rowsOf(unit, "externalFiles")
          .filter((row) => row.projectId === scope.projectId)
          .map((row) => admitExternalFileRow(row, limits.maxPathBytes));
      } catch (error) {
        return {
          accepted: false,
          sourceDirectory: asked.sourceDirectory,
          reason: "corrupt",
          detail: failure(error)
        };
      }
      const members = projectRows.filter((row) =>
        externalDirectoryContains(asked.sourceDirectory, row.relativePath)
      );
      if (members.length === 0) return {
        accepted: false,
        sourceDirectory: asked.sourceDirectory,
        reason: "not-found",
        detail: "That virtual directory no longer contains project files."
      };
      const token = externalDirectoryRevisionToken(members.map((row) => ({
        item: { id: row._id, revision: row.revision, relativePath: row.relativePath }
      })));
      if (token !== asked.baseRevisionToken) return {
        accepted: false,
        sourceDirectory: asked.sourceDirectory,
        reason: "stale",
        detail: "Files in that directory changed. Refresh before moving it."
      };

      let destinations: string[];
      try {
        destinations = members.map((row) => externalRelativePathWithin(
          `${asked.destinationDirectory}/${row.relativePath.slice(asked.sourceDirectory.length + 1)}`,
          limits.maxPathBytes
        ));
      } catch (error) {
        return {
          accepted: false,
          sourceDirectory: asked.sourceDirectory,
          reason: "invalid-destination",
          detail: failure(error)
        };
      }
      const memberIds = new Set(members.map((row) => row._id));
      const heldPaths = projectRows
        .filter((row) => !memberIds.has(row._id))
        .map((row) => row.relativePath);
      if (externalPathSetHasConflicts([...destinations, ...heldPaths])) return {
        accepted: false,
        sourceDirectory: asked.sourceDirectory,
        reason: "path-conflict",
        detail: "The destination would collide with another project file."
      };

      const at = Date.now();
      members.forEach((row, index) => {
        const changed = replaceExternalFileIn(
          model,
          unit,
          scope,
          row,
          { relativePath: destinations[index]! },
          at
        );
        recordExternalFileActivity(unit, scope, {
          kind: "external-file.moved",
          file: {
            id: changed.row._id,
            name: changed.row.name,
            relativePath: changed.row.relativePath
          },
          previousRelativePath: row.relativePath
        });
      });
      return {
        accepted: true,
        sourceDirectory: asked.sourceDirectory,
        destinationDirectory: asked.destinationDirectory,
        movedFiles: members.length,
        externalFileIds: members.map((row) => row._id)
      };
    });
  } catch (error) {
    return {
      accepted: false,
      sourceDirectory: asked.sourceDirectory,
      reason: "store-failed",
      detail: failure(error)
    };
  }
};
