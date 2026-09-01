import type { Category } from "$representation/data/types/workspace/categories";
import { isSingleton } from "$model/client/workspace-state/methods/shared/defaults";

type Identified = { readonly category: Category; readonly resourceId?: string };

export const targetKey = (target: Identified): string | undefined => {
  if (isSingleton(target.category)) return target.category;
  if (target.resourceId !== undefined) return `${target.category}:${target.resourceId}`;
  return undefined;
};
