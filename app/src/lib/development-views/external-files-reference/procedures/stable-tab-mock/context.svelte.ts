import { getContext, setContext } from "svelte";

import type { StableTabMockState } from "$development-views/external-files-reference/components/stable-tab-mock.state.svelte";

const KEY = Symbol("external-files-reference-stable-tab-mock");

export const provideStableTabMockState = (state: StableTabMockState): void => {
  setContext(KEY, state);
};

export const stableTabMockState = (): StableTabMockState =>
  getContext<StableTabMockState>(KEY);
