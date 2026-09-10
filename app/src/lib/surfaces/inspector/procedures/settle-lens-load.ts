import type {
  LensLoader,
  LensModule
} from "$surfaces/inspector/shared/inspector-state.svelte";

export type LensLoadSettlement = {
  readonly current: () => boolean;
  readonly loaded: (module: LensModule, path: string) => void;
  readonly failed: (reason: string, path: string) => void;
};

/** Settle one lens import while swallowing results retired by a route change. */
export const settleLensLoad = async (
  loader: LensLoader,
  path: string,
  settlement: LensLoadSettlement
): Promise<void> => {
  try {
    const module = await loader();
    if (settlement.current()) settlement.loaded(module, path);
  } catch (reason) {
    if (settlement.current()) settlement.failed(String(reason), path);
  }
};
