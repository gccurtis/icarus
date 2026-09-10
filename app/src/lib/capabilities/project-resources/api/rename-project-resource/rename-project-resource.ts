import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";
import { isStoredEditableResource } from "$representation/data/behavior/project-resources/stored";

import { validateRenameProjectResource } from "$capabilities/project-resources/api/rename-project-resource/validate-rename-project-resource";
import type { RenameProjectResourceResult } from "$capabilities/project-resources/types/project-resources";

const tableOf = (id: string): "documents" | "slideDecks" | "spreadsheets" | undefined => {
  const prefix = id.slice(0, id.indexOf(":"));
  return prefix === "documents" || prefix === "slideDecks" || prefix === "spreadsheets"
    ? prefix
    : undefined;
};

export const renameProjectResource = async (input: unknown): Promise<RenameProjectResourceResult> => {
  const scope = await requireScope();
  const asked = validateRenameProjectResource(input);
  const table = tableOf(asked.resourceId);
  if (table === undefined) {
    throw new Error(`project-resources/rename-project-resource: unsupported resource ${asked.resourceId}`);
  }
  const at = Date.now();
  const store = serverModel().store;
  return store.transaction((unit) => {
    const found = unit.read(table);
    const claims = found?.kind === "table" && found.table === table
      ? found.rows.filter((candidate) => candidate._id === asked.resourceId)
      : [];
    const row = claims.length === 1 && isStoredEditableResource(claims[0], table)
      ? claims[0]
      : undefined;
    if (row === undefined || row.projectId !== scope.projectId) {
      throw new Error(`project-resources/rename-project-resource: no resource ${asked.resourceId}`);
    }
    unit.update(`${table}.${row._id}`, {
      projectId: row.projectId,
      title: asked.title,
      ...(row.summary === undefined ? {} : { summary: row.summary }),
      createdBy: row.createdBy,
      updatedBy: { kind: "user", userId: asId<"users">(scope.userId) },
      updatedAt: at
    });
    return { resourceId: asked.resourceId, title: asked.title, updatedAt: at };
  });
};
