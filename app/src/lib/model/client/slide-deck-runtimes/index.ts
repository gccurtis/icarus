/**
 * The entry for SlideDeckRuntimes.
 *
 * The composition root takes the constructor; every other object takes the
 * types. `Runtime` and `SlideDeckRuntimesState` do not cross — they are the
 * definition's, and a consumer holding one could hold a runtime past its
 * release.
 */
export { createSlideDeckRuntimes } from "$model/client/slide-deck-runtimes/constructor";
export type {
  SlideDeckRuntime,
  SlideDeckRuntimesModel,
  SyncState
} from "$model/client/slide-deck-runtimes/types";
