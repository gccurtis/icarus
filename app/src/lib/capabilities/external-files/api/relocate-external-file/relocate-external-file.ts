import { externalPathIn, externalRelativePathWithin } from "$representation/data/behavior/external/file";
import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import {
  externalPathIsAvailable,
  replaceExternalFileIn
} from "$capabilities/external-files/api/shared/mutations";
import { externalFileRowIn } from "$capabilities/external-files/api/shared/rows";
import { validateRelocateExternalFile } from "$capabilities/external-files/api/relocate-external-file/validate-relocate-external-file";
import type { RelocateExternalFileResult } from "$capabilities/external-files/types/external-files";

const failure = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error)).slice(0, 400);

export const relocateExternalFile = async (
  input: unknown
): Promise<RelocateExternalFileResult> => {
  const scope = await requireScope();
  const asked = validateRelocateExternalFile(input);
  const model = serverModel();
  const limits = externalFilesLimits(model.configuration);

  try {
    const committed = model.store.transaction((unit) => {
      let row;
      try {
        row = externalFileRowIn(unit, scope.projectId, asked.externalFileId, limits.maxPathBytes);
      } catch (error) {
        return { kind: "corrupt" as const, detail: failure(error) };
      }
      if (row === null) return { kind: "not-found" as const };
      if (row.revision !== asked.baseRevision) {
        return { kind: "stale" as const, revision: row.revision };
      }

      let relativePath;
      try {
        relativePath = externalRelativePathWithin(
          externalPathIn(asked.destinationDirectory, row.name),
          limits.maxPathBytes
        );
      } catch (error) {
        return { kind: "invalid-path" as const, revision: row.revision, detail: failure(error) };
      }
      if (relativePath === row.relativePath) return { kind: "unchanged" as const, row };
      if (!externalPathIsAvailable(unit, scope.projectId, relativePath, new Set([row._id]))) {
        return { kind: "path-conflict" as const, revision: row.revision };
      }
      const changed = replaceExternalFileIn(model, unit, scope, row, { relativePath }, {
        event: "moved",
        detail: `${row.relativePath} → ${relativePath}`
      }, Date.now());
      return { kind: "changed" as const, ...changed };
    });

    if (committed.kind === "not-found") return {
      accepted: false, externalFileId: asked.externalFileId, reason: "not-found", revision: null,
      detail: "No file in this project has that id."
    };
    if (committed.kind === "corrupt") return {
      accepted: false, externalFileId: asked.externalFileId, reason: "corrupt", revision: null,
      detail: committed.detail
    };
    if (committed.kind === "stale") return {
      accepted: false, externalFileId: asked.externalFileId, reason: "stale",
      revision: committed.revision,
      detail: `Authored against revision ${asked.baseRevision}; the file is at ${committed.revision}.`
    };
    if (committed.kind === "invalid-path") return {
      accepted: false, externalFileId: asked.externalFileId, reason: "invalid-path",
      revision: committed.revision, detail: committed.detail
    };
    if (committed.kind === "path-conflict") return {
      accepted: false, externalFileId: asked.externalFileId, reason: "path-conflict",
      revision: committed.revision, detail: "Another file already occupies that path."
    };
    if (committed.kind === "unchanged") return {
      accepted: true, externalFileId: committed.row._id, revision: committed.row.revision,
      relativePath: committed.row.relativePath, semantic: "unsupported"
    };
    return {
      accepted: true, externalFileId: committed.row._id, revision: committed.row.revision,
      relativePath: committed.row.relativePath, semantic: committed.semantic
    };
  } catch (error) {
    return {
      accepted: false, externalFileId: asked.externalFileId, reason: "store-failed",
      revision: asked.baseRevision, detail: failure(error)
    };
  }
};
