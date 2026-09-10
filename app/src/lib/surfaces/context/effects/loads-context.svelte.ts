import type {
  ContextLoader,
  ContextState
} from "$surfaces/context/shared/context-state.svelte";
import { settleContextLoad } from "$surfaces/context/procedures/settle-context-load";

export type ContextLoading = {
  readonly state: ContextState;
  readonly path: () => string | undefined;
  readonly loader: () => ContextLoader | undefined;
};

/** Load one context route without allowing an earlier route to mount late. */
export const loadContext = (loading: ContextLoading): void => {
  $effect(() => {
    const loader = loading.loader();
    const wantedPath = loading.path();
    const { state } = loading;

    state.content = undefined;
    state.loadedPath = undefined;
    state.failure = undefined;
    if (loader === undefined || wantedPath === undefined) return;

    let current = true;
    void settleContextLoad(loader, wantedPath, {
      current: () => current,
      loaded: (module, path) => {
        state.content = module.default;
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
