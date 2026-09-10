import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import {
  refNamesExternalFile,
  resourceSetNamesExternalFile
} from "$capabilities/external-files/api/shared/resource-references";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import { usageItem } from "$capabilities/external-files/api/shared/usage/shared";
import type { ExternalFileUsageItem } from "$capabilities/external-files/types/read";

export const agentUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): readonly ExternalFileUsageItem[] => {
  const items: ExternalFileUsageItem[] = [];
  const inProject = <T extends { readonly projectId: string }>(row: T) =>
    row.projectId === scope.projectId;
  for (const persona of rowsOf(store, "personas")) {
    if (inProject(persona) && persona.scope !== undefined &&
      resourceSetNamesExternalFile(persona.scope, externalFileId)) {
      items.push(usageItem("persona", persona._id, persona.name));
    }
  }
  for (const task of rowsOf(store, "agentTasks")) {
    if (!inProject(task)) continue;
    const named = (
      task.scope !== undefined && resourceSetNamesExternalFile(task.scope, externalFileId)
    ) || task.outputs.some((output) =>
      output.ref !== undefined && refNamesExternalFile(output.ref, externalFileId)
    ) || (
      task.origin.kind === "automation" && task.origin.ref !== undefined &&
      refNamesExternalFile(task.origin.ref, externalFileId)
    );
    if (named) items.push(usageItem("agent-task", task._id, task.title));
  }
  for (const automation of rowsOf(store, "automations")) {
    if (!inProject(automation)) continue;
    const named = (
      automation.scope !== undefined &&
      resourceSetNamesExternalFile(automation.scope, externalFileId)
    ) || (
      automation.trigger.kind === "resource-edited" &&
      automation.trigger.ref !== undefined &&
      refNamesExternalFile(automation.trigger.ref, externalFileId)
    );
    if (named) items.push(usageItem("automation", automation._id, automation.name));
  }
  return items;
};
