import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import {
  contentBlocksNameExternalFile,
  formulaValueNamesExternalFile,
  refNamesExternalFile,
  resourceSetNamesExternalFile
} from "$capabilities/external-files/api/shared/resource-references";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import { usageItem } from "$capabilities/external-files/api/shared/usage/shared";
import type { ExternalFileUsageItem } from "$capabilities/external-files/types/read";

export const outputUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): readonly ExternalFileUsageItem[] => {
  const items: ExternalFileUsageItem[] = [];
  const inProject = <T extends { readonly projectId: string }>(row: T) =>
    row.projectId === scope.projectId;
  for (const output of rowsOf(store, "derivedOutputs")) {
    if (!inProject(output)) continue;
    const named = (
      output.origin !== undefined && refNamesExternalFile(output.origin, externalFileId)
    ) || (
      output.scope !== undefined && resourceSetNamesExternalFile(output.scope, externalFileId)
    ) || (
      output.lastResponse !== undefined &&
      contentBlocksNameExternalFile([output.lastResponse], externalFileId)
    );
    if (named) {
      items.push(usageItem(
        "derived-output",
        output._id,
        output.prompt.slice(0, 80) || "Derived output"
      ));
    }
  }
  for (const job of rowsOf(store, "derivedOutputRefreshJobs")) {
    if (inProject(job) && job.selection !== undefined &&
      refNamesExternalFile(job.selection.ref, externalFileId)) {
      items.push(usageItem("derived-output", job.derivedOutputId, "Derived output refresh"));
    }
  }
  for (const variable of rowsOf(store, "variables")) {
    if (inProject(variable) && formulaValueNamesExternalFile(variable.value, externalFileId)) {
      items.push(usageItem("variable", variable._id, variable.name));
    }
  }
  for (const formula of rowsOf(store, "formulas")) {
    if (!inProject(formula)) continue;
    if (formula.usedBy.some((use) =>
      use.in === "resource" && refNamesExternalFile(use.ref, externalFileId)
    )) {
      items.push(usageItem(
        "formula",
        formula._id,
        formula.representation.slice(0, 80) || "Formula"
      ));
    }
  }
  return items;
};
