import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import {
  contentBlocksNameExternalFile,
  refNamesExternalFile
} from "$capabilities/external-files/api/shared/resource-references";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import { usageItem } from "$capabilities/external-files/api/shared/usage/shared";
import type { ExternalFileUsageItem } from "$capabilities/external-files/types/read";

export const investigationUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): readonly ExternalFileUsageItem[] => {
  const items: ExternalFileUsageItem[] = [];
  const inProject = <T extends { readonly projectId: string }>(row: T) =>
    row.projectId === scope.projectId;
  for (const finding of rowsOf(store, "findings")) {
    if (!inProject(finding)) continue;
    const named = contentBlocksNameExternalFile(finding.body, externalFileId) ||
      finding.sources.some((source) =>
        source.kind === "resource" && refNamesExternalFile(source.ref, externalFileId)
      );
    if (named) items.push(usageItem("finding", finding._id, finding.title));
  }
  for (const question of rowsOf(store, "questions")) {
    if (inProject(question) && contentBlocksNameExternalFile(question.notes, externalFileId)) {
      items.push(usageItem("question", question._id, question.text));
    }
  }
  for (const hypothesis of rowsOf(store, "hypotheses")) {
    if (inProject(hypothesis) && contentBlocksNameExternalFile(hypothesis.notes, externalFileId)) {
      items.push(usageItem("hypothesis", hypothesis._id, hypothesis.statement));
    }
  }
  for (const comment of rowsOf(store, "comments")) {
    if (!inProject(comment)) continue;
    const named = contentBlocksNameExternalFile(comment.blocks, externalFileId) ||
      comment.mentions.some((mention) =>
        mention.kind === "resource" && refNamesExternalFile(mention.ref, externalFileId)
      );
    if (named) items.push(usageItem("comment", comment._id, "Comment"));
  }
  return items;
};
