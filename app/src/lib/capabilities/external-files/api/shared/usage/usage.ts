import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import { agentUsage } from "$capabilities/external-files/api/shared/usage/agents";
import { conversationUsage } from "$capabilities/external-files/api/shared/usage/conversations";
import { investigationUsage } from "$capabilities/external-files/api/shared/usage/investigations";
import { outputUsage } from "$capabilities/external-files/api/shared/usage/outputs";
import { resourceUsage } from "$capabilities/external-files/api/shared/usage/resources";
import type { ExternalFileUsage } from "$capabilities/external-files/types/read";

/** Traverses every current identity-bearing reference that blocks deletion. */
export const externalFileUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): ExternalFileUsage => {
  const items = [
    ...resourceUsage(store, scope, externalFileId),
    ...investigationUsage(store, scope, externalFileId),
    ...conversationUsage(store, scope, externalFileId),
    ...agentUsage(store, scope, externalFileId),
    ...outputUsage(store, scope, externalFileId)
  ];
  const unique = [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()]
    .sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
  return { total: unique.length, items: unique };
};
