import type {
  InspectorState,
  LensLoader
} from "$surfaces/inspector/shared/inspector-state.svelte";
import { settleLensLoad } from "$surfaces/inspector/procedures/settle-lens-load";

export type LensLoading = {
  readonly state: InspectorState;
  readonly path: () => string | undefined;
  readonly loader: () => LensLoader | undefined;
};

/** Load one inspector lens without exposing a result from an earlier route. */
export const loadLens = (loading: LensLoading): void => {
  $effect(() => {
    const loader = loading.loader();
    const wantedPath = loading.path();
    const { state } = loading;

    state.lens = undefined;
    state.loadedPath = undefined;
    state.failure = undefined;
    if (loader === undefined || wantedPath === undefined) return;

    let current = true;
    void settleLensLoad(loader, wantedPath, {
      current: () => current,
      loaded: (module, path) => {
        state.lens = module.default;
        state.loadedPath = path;
      },
      failed: (reason, path) => {
        state.failure = { path, reason };
      }
    });
    return () => {
      current = false;
    };
  });
};
