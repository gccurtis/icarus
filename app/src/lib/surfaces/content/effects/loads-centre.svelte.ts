import type {
  CentreLoader,
  ContentState
} from "$surfaces/content/shared/content-state.svelte";
import { settleCentreLoad } from "$surfaces/content/procedures/settle-centre-load";

export type CentreLoading = {
  readonly state: ContentState;
  readonly path: () => string;
  readonly loader: () => CentreLoader | undefined;
};

/**
 * Load the component named by the active tab and retire every stale result.
 *
 * The route changes synchronously while a dynamic import settles later. The
 * cancellation flag and the path recorded beside a result jointly guarantee
 * that a component is visible only for the route which loaded it.
 */
export const loadCentre = (loading: CentreLoading): void => {
  $effect(() => {
    const loader = loading.loader();
    const wantedPath = loading.path();
    const { state } = loading;

    state.centre = undefined;
    state.loadedPath = undefined;
    state.failure = undefined;
    state.missing = loader === undefined ? wantedPath : undefined;
    if (loader === undefined) return;

    let current = true;
    void settleCentreLoad(loader, wantedPath, {
      current: () => current,
      loaded: (module, path) => {
        state.centre = module.default;
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
