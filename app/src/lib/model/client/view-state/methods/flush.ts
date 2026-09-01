import type { ViewStateData } from "$model/client/view-state/definition.svelte";
import { submit } from "$model/client/view-state/methods/shared/submit";

export const flush = (state: ViewStateData): Promise<void> => submit(state);
