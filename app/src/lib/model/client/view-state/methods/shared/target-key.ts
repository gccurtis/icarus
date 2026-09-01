import type { Screen } from "$representation/data/types/views/screens";
import { isSingleton } from "$model/client/view-state/methods/shared/defaults";

type Identified = { readonly screen: Screen; readonly resourceId?: string };

export const targetKey = (target: Identified): string | undefined => {
  if (isSingleton(target.screen)) return target.screen;
  if (target.resourceId !== undefined) return `${target.screen}:${target.resourceId}`;
  return undefined;
};
