import type {
  CentreLoader,
  CentreModule
} from "$surfaces/content/shared/content-state.svelte";

export type CentreLoadSettlement = {
  readonly current: () => boolean;
  readonly loaded: (module: CentreModule, path: string) => void;
  readonly failed: (reason: string, path: string) => void;
};

/** Settle one centre import while swallowing results retired by a tab change. */
export const settleCentreLoad = async (
  loader: CentreLoader,
  path: string,
  settlement: CentreLoadSettlement
): Promise<void> => {
  try {
    const module = await loader();
    if (settlement.current()) settlement.loaded(module, path);
  } catch (reason) {
    if (settlement.current()) settlement.failed(String(reason), path);
  }
};
