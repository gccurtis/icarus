import type { TabTarget } from "$model/client/workbench/types";

/**
 * A target's identity, and the whole definition of "already open".
 *
 * `:` separates the two halves because neither may contain one, so no two
 * different targets can produce one key.
 *
 * **A launcher returns `undefined`, and that is the whole of "never dedupes".**
 * It has no identity, so `open` finds nothing to match and mints a fresh tab
 * every time. Open five, get five.
 *
 * Shared because `open` and `resolveLauncher` must agree on it exactly. Two
 * spellings of one target is two tabs on one document, which is the thing
 * matching exists to prevent.
 */
export const targetKey = (target: TabTarget): string | undefined => {
  switch (target.kind) {
    case "singleton":
      return `singleton:${target.screen}`;
    case "resource":
      return `${target.resourceType}:${target.resourceId}`;
    case "launcher":
      return undefined;
  }
};
