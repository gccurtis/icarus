import type {
  ContextLoader,
  ContextModule
} from "$surfaces/context/shared/context-state.svelte";

export type ContextLoadSettlement = {
  readonly current: () => boolean;
  readonly loaded: (module: ContextModule, path: string) => void;
  readonly failed: (reason: string, path: string) => void;
};

/** Settle one context import while swallowing results retired by a route change. */
export const settleContextLoad = async (
  loader: ContextLoader,
  path: string,
  settlement: ContextLoadSettlement
): Promise<void> => {
  try {
    const module = await loader();
    if (settlement.current()) settlement.loaded(module, path);
  } catch (reason) {
    if (settlement.current()) settlement.failed(String(reason), path);
  }
};
