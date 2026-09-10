import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import {
  contentBlocksNameExternalFile,
  refNamesExternalFile
} from "$capabilities/external-files/api/shared/resource-references";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import { representedName, usageItem } from "$capabilities/external-files/api/shared/usage/shared";
import type { ExternalFileUsageItem } from "$capabilities/external-files/types/read";

export const conversationUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): readonly ExternalFileUsageItem[] => {
  const items: ExternalFileUsageItem[] = [];
  const inProject = <T extends { readonly projectId: string }>(row: T) =>
    row.projectId === scope.projectId;
  const threads = new Map(rowsOf(store, "researchThreads").filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const turn of rowsOf(store, "researchTurns")) {
    if (!inProject(turn)) continue;
    const named = (
      turn.scope.kind === "resource" && refNamesExternalFile(turn.scope.ref, externalFileId)
    ) || turn.sources.some((source) => refNamesExternalFile(source.ref, externalFileId)) ||
      contentBlocksNameExternalFile(turn.blocks, externalFileId);
    if (named) {
      items.push(usageItem(
        "research",
        turn.researchThreadId,
        representedName(threads, turn.researchThreadId, "research turn")
      ));
    }
  }
  for (const part of rowsOf(store, "threadParts")) {
    if (!inProject(part)) continue;
    const named = part.messages.some((message) =>
      contentBlocksNameExternalFile(message.blocks, externalFileId) ||
      (message.attachments ?? []).some((ref) => refNamesExternalFile(ref, externalFileId))
    );
    if (named) items.push(usageItem("thread", part.threadId, "Conversation"));
  }
  return items;
};
